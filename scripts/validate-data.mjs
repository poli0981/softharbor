// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * L2 data validation (docs/03 §2). Catches what the Zod schema structurally
 * cannot: rules that span files, involve the filename or the filesystem, or
 * judge a URL's provenance rather than its syntax.
 *
 * Plain Node — runs OUTSIDE Astro, so it must never import astro:content.
 * Prints `file → rule → detail` and exits non-zero on any error. Warnings
 * (staleness) are printed but do not fail the build.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const APPS_DIR = join(process.cwd(), 'src/data/apps');
const QUARANTINE_DIR = join(process.cwd(), 'data/quarantine');
const LOGOS_DIR = join(process.cwd(), 'src/assets/logos');
const CATEGORIES = join(process.cwd(), 'src/data/categories.json');

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX = 40;
/** docs/13 §6 — a security check older than this is due for a re-check. */
const STALE_DAYS = 180;
const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Download portals and mirror sites (CONTRIBUTING: "official links only").
 * They repackage installers, bundle adware, or simply are not the developer.
 * Matched on the host and its subdomains.
 */
const PORTALS = [
  'softpedia.com',
  'filehorse.com',
  'uptodown.com',
  'download.cnet.com',
  'majorgeeks.com',
  'filehippo.com',
  'softonic.com',
  'fosshub.com',
  'techspot.com',
  'malavida.com',
  'chip.de',
  'portableapps.com',
  'apkmirror.com',
  'getintopc.com',
];
/** Analytics and affiliate parameters have no place in an "official" link. */
const TRACKING_PARAM =
  /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_eid|ref|aff|affiliate|partner)$/i;
/** Zero-width and bidi-control characters: invisible, and a classic spoofing tool. */
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/;

const errors = [];
const warnings = [];
const fail = (file, rule, detail) => errors.push({ file, rule, detail });
const warn = (file, rule, detail) => warnings.push({ file, rule, detail });

/** Same fold as src/lib/normalize.ts — duplicated because this script runs in
 *  plain Node and must not import from src/. Only used for duplicate names. */
const normalizeViet = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Every string value in an entry, with its JSON path, for character checks. */
function* strings(value, path = '') {
  if (typeof value === 'string') {
    yield [path, value];
  } else if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) yield* strings(v, `${path}[${i}]`);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k);
  }
}

function checkUrl(file, field, raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(file, 'bad-url', `${field} = ${raw}`);
    return;
  }
  if (url.protocol !== 'https:') fail(file, 'insecure-link', `${field} = ${raw}`);
  if (url.hostname.split('.').some((label) => label.startsWith('xn--'))) {
    fail(
      file,
      'punycode-host',
      `${field} uses an IDN host (${url.hostname}) — check for a lookalike`,
    );
  }
  const host = url.hostname.replace(/^www\./, '');
  const portal = PORTALS.find((p) => host === p || host.endsWith(`.${p}`));
  if (portal) fail(file, 'download-portal', `${field} points at ${portal}, not the developer`);
  for (const key of url.searchParams.keys()) {
    if (TRACKING_PARAM.test(key)) fail(file, 'tracking-param', `${field} carries ?${key}=`);
  }
}

const categoryIds = new Set(JSON.parse(readFileSync(CATEGORIES, 'utf8')).map((c) => c.id));
const logoFiles = existsSync(LOGOS_DIR) ? new Set(readdirSync(LOGOS_DIR)) : new Set();
const files = existsSync(APPS_DIR) ? readdirSync(APPS_DIR).filter((f) => f.endsWith('.json')) : [];
const seenName = new Map();
const slugs = new Set();

for (const file of files) {
  const slug = file.replace(/\.json$/, '');
  slugs.add(slug);
  let app;
  try {
    app = JSON.parse(readFileSync(join(APPS_DIR, file), 'utf8'));
  } catch (e) {
    fail(file, 'parse', e.message);
    continue;
  }

  // Zod never sees the filename, but the filename IS the slug — it is the URL
  // and the RSS guid (docs/04 §2). (Duplicate slugs cannot happen: filenames
  // in one directory are unique — the old check for them could never fire.)
  if (!SLUG_RE.test(slug)) fail(file, 'slug-format', `"${slug}" is not kebab-case [a-z0-9-]`);
  if (slug.length > SLUG_MAX) fail(file, 'slug-length', `${slug.length} chars, max ${SLUG_MAX}`);

  // Two entries for the same product, differing only by accent or case, is a
  // curation error a human reviewer reliably misses.
  if (typeof app.name === 'string') {
    const key = normalizeViet(app.name);
    if (seenName.has(key)) {
      fail(file, 'duplicate-name', `"${app.name}" collides with ${seenName.get(key)}`);
    }
    seenName.set(key, file);
  }

  for (const id of app.categories ?? []) {
    if (!categoryIds.has(id)) fail(file, 'unknown-category', `"${id}" not in categories.json`);
  }

  for (const [k, v] of Object.entries(app.links ?? {})) {
    if (v !== null) checkUrl(file, `links.${k}`, String(v));
  }
  if (app.security?.evidence) checkUrl(file, 'security.evidence', app.security.evidence);

  for (const [path, value] of strings(app)) {
    if (INVISIBLE.test(value)) {
      fail(file, 'invisible-char', `${path} contains a zero-width or bidi control character`);
    }
  }

  // Hard rule 5: a flagged entry must be in data/quarantine/, never here.
  // `pnpm quarantine` moves it; the PR then carries both the flag and the move.
  if (app.security?.status === 'flagged') {
    fail(
      file,
      'flagged-in-main-tree',
      'run `pnpm quarantine` to move it to data/quarantine/ (docs/03 §5)',
    );
  }

  // A local: logo that does not exist fails the build far away from the
  // cause. Compared against the directory listing, not existsSync, because
  // Windows' case-insensitive filesystem would accept a wrong-case name that
  // Linux CI and Workers Builds then reject.
  const local = /^local:(.+)$/.exec(app.logo ?? '');
  if (local && !logoFiles.has(local[1])) {
    fail(file, 'missing-logo', `src/assets/logos/${local[1]} not found (names are case-sensitive)`);
  }

  for (const field of ['addedAt', 'updatedAt']) {
    if (app[field] && app[field] > TODAY) {
      fail(file, 'future-date', `${field} ${app[field]} is after today`);
    }
  }
  if (app.security?.checkedAt && app.security.checkedAt > TODAY) {
    fail(file, 'future-date', `security.checkedAt ${app.security.checkedAt} is after today`);
  }
  if (app.updatedAt && app.addedAt && app.updatedAt < app.addedAt) {
    fail(file, 'date-order', `updatedAt ${app.updatedAt} precedes addedAt ${app.addedAt}`);
  }

  // "No known warnings as of <date>" is only honest while <date> is recent.
  if (app.security?.checkedAt) {
    const age = daysBetween(app.security.checkedAt, TODAY);
    if (age > STALE_DAYS) {
      warn(file, 'stale-check', `security checked ${age} days ago — re-verify (docs/13 §6)`);
    }
  }
}

// Quarantined entries must keep status flagged, or restoring them silently
// republishes something that was pulled.
if (existsSync(QUARANTINE_DIR)) {
  for (const file of readdirSync(QUARANTINE_DIR).filter((f) => f.endsWith('.json'))) {
    try {
      const q = JSON.parse(readFileSync(join(QUARANTINE_DIR, file), 'utf8'));
      if (q.security?.status !== 'flagged') {
        fail(
          `data/quarantine/${file}`,
          'unflagged-in-quarantine',
          `status is "${q.security?.status}"`,
        );
      }
      if (slugs.has(file.replace(/\.json$/, ''))) {
        fail(`data/quarantine/${file}`, 'slug-in-both-trees', 'same slug is live and quarantined');
      }
    } catch (e) {
      fail(`data/quarantine/${file}`, 'parse', e.message);
    }
  }
}

if (warnings.length > 0) {
  // Grouped: 326 identical "stale" lines on the same day would help nobody.
  for (const [rule, list] of Map.groupBy(warnings, (w) => w.rule)) {
    const plural = list.length === 1 ? 'entry' : 'entries';
    console.warn(`  ! ${rule}: ${list.length} ${plural} — e.g. ${list[0].file}: ${list[0].detail}`);
  }
}

if (errors.length > 0) {
  console.error(`validate:data — ${errors.length} problem(s):\n`);
  const w = Math.max(...errors.map((e) => e.file.length));
  for (const e of errors) {
    console.error(`  ✗ ${e.file.padEnd(w)}  ${e.rule.padEnd(22)}  ${e.detail}`);
  }
  process.exitCode = 1;
} else {
  console.log(`validate:data — OK (${files.length} apps, ${categoryIds.size} categories)`);
}
