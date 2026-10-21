// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Post-build HTML fix-ups. Runs between `astro build` and the dist/ checks.
 *
 * 1. Move the CSP <meta> to the top of <head>.
 *
 *    A meta-tag CSP only governs what the parser meets AFTER it. Astro appends
 *    its generated tag at the END of <head>, behind every blocking and
 *    deferred script there (errors.js, theme.js, registerSW.js) — so those
 *    loaded under no policy at all. They are our own same-origin files and
 *    would pass `script-src 'self'` anyway; the point is that NOTHING in the
 *    document should precede the policy that is supposed to cover it. Placing
 *    the tag right after `<meta charset>` (which must stay first, within the
 *    first 1024 bytes) makes the whole head subject to it. check-csp.mjs
 *    asserts the result on every page.
 *
 * Idempotent: a page whose meta already follows the charset is left alone.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const CHARSET = '<meta charset="utf-8">';
const CSP_META = /<meta http-equiv="content-security-policy" content="[^"]*">/i;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

let moved = 0;
let pages = 0;
for (const file of walk(DIST)) {
  pages++;
  const html = readFileSync(file, 'utf8');
  const meta = CSP_META.exec(html)?.[0];
  const at = html.indexOf(CHARSET);
  if (!meta || at === -1) continue; // check-csp.mjs reports both cases
  if (html.indexOf(meta) === at + CHARSET.length) continue;
  const without = html.replace(meta, '');
  const insertAt = without.indexOf(CHARSET) + CHARSET.length;
  writeFileSync(file, without.slice(0, insertAt) + meta + without.slice(insertAt));
  moved++;
}

console.log(`postbuild — CSP meta moved to the top of <head> on ${moved} of ${pages} pages`);
