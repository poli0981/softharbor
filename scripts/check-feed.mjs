// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Build guard: dist/rss.xml must be the feed notify.py can trust.
 *
 * WHY THIS EXISTS. A cross-poster (notify.py) reads /rss.xml on a schedule
 * and announces every <guid> it has not seen before — to Telegram, Discord,
 * Bluesky, Mastodon, X and Facebook. So the feed's failure modes are public
 * and irreversible: a GUID that changes shape (a URL instead of the slug, a
 * slug with a different case) re-announces the whole window, and a GUID that
 * names no app announces a dead link. src/lib/feed.ts builds the items and is
 * unit-tested; this asserts what actually got EMITTED, because @astrojs/rss
 * has no guid option and the slug guid is injected through customData
 * (src/pages/rss.xml.ts) — exactly the kind of seam a dependency update
 * breaks with every test still green.
 *
 * Checks: 1–50 items; every item has exactly one <guid isPermaLink="false">
 * holding a slug of an app in src/data/apps; guids are unique; <link> is
 * that app's page; <pubDate> parses and items run newest first.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FEED = join(process.cwd(), 'dist/rss.xml');
const APPS_DIR = join(process.cwd(), 'src/data/apps');
const SITE = 'https://softharbor.net';
const LIMIT = 50;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const problems = [];
let items = [];

if (existsSync(FEED)) {
  const xml = readFileSync(FEED, 'utf8');
  items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  if (items.length === 0) problems.push('the feed has no <item>');
  if (items.length > LIMIT) problems.push(`${items.length} items — the window is ${LIMIT}`);

  const seen = new Set();
  let previous = Infinity;
  for (const [i, item] of items.entries()) {
    const where = `item ${i + 1}`;
    const guids = [...item.matchAll(/<guid\b([^>]*)>([^<]*)<\/guid>/g)];
    if (guids.length !== 1) {
      problems.push(`${where}: ${guids.length} <guid> elements (want exactly 1)`);
      continue;
    }
    const [, attrs, slug] = guids[0];
    if (!/\bisPermaLink="false"/.test(attrs)) {
      problems.push(
        `${where}: <guid> is not isPermaLink="false" — a URL guid changes with the URL`,
      );
    }
    if (!SLUG_RE.test(slug)) {
      problems.push(`${where}: guid "${slug}" is not a slug`);
    } else if (!existsSync(join(APPS_DIR, `${slug}.json`))) {
      problems.push(`${where}: guid "${slug}" names no app in src/data/apps`);
    }
    if (seen.has(slug)) problems.push(`${where}: duplicate guid "${slug}"`);
    seen.add(slug);

    const link = /<link>([^<]*)<\/link>/.exec(item)?.[1];
    if (link !== `${SITE}/apps/${slug}`) {
      problems.push(`${where}: <link> ${link ?? '(none)'} is not ${SITE}/apps/${slug}`);
    }

    const when = Date.parse(/<pubDate>([^<]*)<\/pubDate>/.exec(item)?.[1] ?? '');
    if (Number.isNaN(when)) problems.push(`${where}: missing or unparseable <pubDate>`);
    else if (when > previous) problems.push(`${where}: newer than the item before it`);
    else previous = when;
  }
} else {
  problems.push('dist/rss.xml does not exist — run `astro build` first');
}

if (problems.length > 0) {
  console.error(`check-feed — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 20)) console.error(`  ✗ ${p}`);
  console.error(
    '\n  notify.py announces every new guid; see docs/05 §A4 before changing the feed.',
  );
  process.exitCode = 1;
} else {
  console.log(`check-feed — OK (${items.length} items, slug guids, newest first)`);
}
