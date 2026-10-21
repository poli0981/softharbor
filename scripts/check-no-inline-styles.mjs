// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Build guard: no inline `style` attributes may reach dist/ (docs/09 §4).
 *
 * WHY THIS EXISTS. CSP `style-src` governs inline style ATTRIBUTES, not just
 * <style> blocks, and hashes do not apply to attributes — only
 * 'unsafe-hashes' or 'unsafe-inline' would permit them. Our policy has
 * neither, so any `style="…"` is silently DROPPED by the browser. Nothing
 * errors: the build passes, the markup looks right in source, and the page
 * renders with the declaration missing.
 *
 * That is exactly how the sticky header shipped transparent and let content
 * bleed through it (2026-07-28). A visual bug from an invisible cause is worth
 * a permanent check, so this runs in CI beside the other gates.
 *
 * Fix for a failure: use a Tailwind utility. Every design token is exposed as
 * one (`text-sh-muted`, `bg-sh-surface`, `border-sh-border`) in
 * src/styles/global.css.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = join(process.cwd(), 'dist');

const CSP_META = /<meta http-equiv="content-security-policy" content="([^"]+)"/i;
const STYLE_EL = /<style[^>]*>([\s\S]*?)<\/style>/gi;
/** Every start tag. `[^>]*` is a single linear run — no nested quantifiers. */
const START_TAG = /<[a-z][^>]*>/gi;
/**
 * A `style` attribute in any of HTML's three value syntaxes — double-quoted,
 * single-quoted or unquoted — and any letter case. Applied to one bounded tag
 * string at a time, which keeps it linear (SonarCloud S8786 flagged the old
 * whole-document pattern for super-linear backtracking).
 */
const STYLE_ATTR = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const sha256 = (s) => `sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}`;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

const offenders = [];
/** Pages with no CSP meta at all — every other check would skip them silently. */
const missingCsp = [];
/** `<style>` elements whose hash is absent from their own page's CSP. */
const unhashed = [];
/** hash -> a page that emits it; and every page's allowed set, for the
 *  cross-page check below. */
const emittedBy = new Map();
const allowedBy = new Map();

for (const file of walk(DIST)) {
  const html = readFileSync(file, 'utf8');
  for (const [tag] of html.matchAll(START_TAG)) {
    const m = STYLE_ATTR.exec(tag);
    if (!m) continue;
    const decl = m[1] ?? m[2] ?? m[3] ?? '';
    // An empty style="" is harmless noise from a framework; a declaration is not.
    if (decl.trim() === '') continue;
    offenders.push({ file: relative(process.cwd(), file), decl: decl.slice(0, 70) });
  }

  // The attribute sweep above misses a whole second category: a `<style>`
  // ELEMENT whose content Astro forgot to hash. `transition:name` shipped
  // exactly that — 1.5 MB of CSS the browser refused on every page, with all
  // eight gates green, because nothing compared the emitted styles against the
  // policy that governs them.
  const rel = relative(process.cwd(), file);
  const csp = CSP_META.exec(html)?.[1];
  if (!csp) {
    // Used to be a bare `continue`: a markup change in how Astro emits the
    // meta tag would have skipped every page and still printed "OK".
    missingCsp.push(rel);
    continue;
  }
  allowedBy.set(rel, new Set(csp.match(/'sha256-[^']+'/g)?.map((h) => h.slice(1, -1)) ?? []));
  for (const m of html.matchAll(STYLE_EL)) {
    const hash = sha256(m[1]);
    if (!emittedBy.has(hash)) emittedBy.set(hash, { file: rel, head: m[1].slice(0, 70) });
    if (!csp.includes(hash)) unhashed.push({ file: rel, hash, head: m[1].slice(0, 70) });
  }
}

// Before v1.1 this also failed on <style> hashes that only SOME pages allowed:
// <ClientRouter /> kept the first page's meta CSP across soft navigations, so
// a page-specific style was refused on arrival. Every navigation is a full
// document load now, each page enforcing its own policy, so the per-page
// check above is the whole story.
const distinctHashes = emittedBy.size;

if (offenders.length > 0) {
  console.error(
    `check-no-inline-styles — ${offenders.length} inline style attribute(s) in dist:\n`,
  );
  const seen = new Set();
  for (const o of offenders) {
    const key = o.decl;
    if (seen.has(key)) continue;
    seen.add(key);
    console.error(`  ✗ ${o.file}\n      style="${o.decl}"`);
  }
  console.error('\n  CSP style-src drops these silently. Use a Tailwind utility instead');
  console.error('  — the design tokens are exposed as one in src/styles/global.css.');
  process.exitCode = 1;
}

if (unhashed.length > 0) {
  console.error(`check-no-inline-styles — ${unhashed.length} <style> element(s) the page's own`);
  console.error('CSP does not allow. The browser refuses these; the build never notices:\n');
  const seen = new Set();
  for (const u of unhashed) {
    if (seen.has(u.hash)) continue;
    seen.add(u.hash);
    console.error(`  ✗ ${u.file}\n      ${u.hash}\n      ${JSON.stringify(u.head)}`);
  }
  console.error(`\n  ${unhashed.length} occurrence(s), ${seen.size} distinct.`);
  console.error('  Astro hashes the styles it knows about; anything it misses must either be');
  console.error('  removed or added via security.csp.styleDirective.hashes (docs/09 §4).');
  process.exitCode = 1;
}

if (missingCsp.length > 0) {
  console.error(`check-no-inline-styles — ${missingCsp.length} page(s) carry no CSP meta tag:\n`);
  for (const f of missingCsp.slice(0, 10)) console.error(`  ✗ ${f}`);
  if (missingCsp.length > 10) console.error(`  … and ${missingCsp.length - 10} more`);
  console.error(
    "\n  Astro's security.csp emits the policy per page; a page without it is unprotected",
  );
  console.error('  and invisible to every other check in this script (docs/09 §4).');
  process.exitCode = 1;
}

if (allowedBy.size === 0) {
  console.error(
    'check-no-inline-styles — found no HTML pages under dist/. Run `astro build` first.',
  );
  process.exitCode = 1;
}

if (
  offenders.length === 0 &&
  unhashed.length === 0 &&
  missingCsp.length === 0 &&
  allowedBy.size > 0
) {
  console.log(
    `check-no-inline-styles — OK (no style attributes; ${distinctHashes} distinct <style> hash(es), ` +
      `each allowed by its own page across ${allowedBy.size} pages)`,
  );
}
