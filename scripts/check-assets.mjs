// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Build guard: every same-origin asset a page references must exist in dist/,
 * and no script may ship as a data: URL.
 *
 * WHY THIS EXISTS. Two failure modes that a green `astro build` hides:
 *
 *  - Vite inlines any `?url` import under `build.assetsInlineLimit` (4 KiB) as
 *    a `data:` URL. Base.astro's pre-paint scripts are smaller than that; as
 *    `<script src="data:…">` they would be refused by `script-src 'self'` on
 *    every page. The `&no-inline` suffix prevents it — this proves it did.
 *  - Astro moves assets emitted from the prerender build into dist/ after the
 *    fact; if that step ever drops a file, the page references a URL that
 *    404s, and only a visitor notices.
 *
 * Checks the asset-bearing attributes only (script src, link href for
 * stylesheets/icons/manifest, img src) — page-to-page links are lychee's job.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const SCRIPT_SRC = /<script\b[^>]*\ssrc="([^"]+)"/gi;
const LINK_TAG = /<link\b[^>]*>/gi;
const IMG_SRC = /<img\b[^>]*\ssrc="([^"]+)"/gi;
const ASSET_RELS = new Set(['stylesheet', 'icon', 'manifest', 'apple-touch-icon', 'modulepreload']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

const problems = [];
const checked = new Set();

function checkUrl(rel, url, kind) {
  if (url.startsWith('data:')) {
    problems.push(`${rel}: ${kind} is a data: URL (${url.slice(0, 40)}…) — CSP refuses it`);
    return;
  }
  // Same-origin, root-relative only; absolute third-party URLs are the CSP's
  // concern, and protocol-relative `//host` is not ours either.
  if (!url.startsWith('/') || url.startsWith('//')) return;
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  if (checked.has(path)) return;
  checked.add(path);
  if (!existsSync(join(DIST, path)))
    problems.push(`${rel}: ${kind} ${path} does not exist in dist/`);
}

let pages = 0;
for (const file of walk(DIST)) {
  pages++;
  const html = readFileSync(file, 'utf8');
  const rel = relative(process.cwd(), file);
  for (const m of html.matchAll(SCRIPT_SRC)) checkUrl(rel, m[1], 'script');
  for (const m of html.matchAll(IMG_SRC)) checkUrl(rel, m[1], 'image');
  for (const [tag] of html.matchAll(LINK_TAG)) {
    const relAttr = /\srel="([^"]+)"/i.exec(tag)?.[1] ?? '';
    const href = /\shref="([^"]+)"/i.exec(tag)?.[1];
    if (href && relAttr.split(/\s+/).some((r) => ASSET_RELS.has(r)))
      checkUrl(rel, href, `link[${relAttr}]`);
  }
}

if (pages === 0) problems.push('found no HTML pages under dist/ — run `astro build` first');

if (problems.length > 0) {
  console.error(`check-assets — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 20)) console.error(`  ✗ ${p}`);
  process.exitCode = 1;
} else {
  console.log(
    `check-assets — OK (${pages} pages, ${checked.size} distinct same-origin assets exist)`,
  );
}
