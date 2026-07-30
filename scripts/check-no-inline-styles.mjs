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
/** `<style>` elements whose hash is absent from their own page's CSP. */
const unhashed = [];
/** hash -> a page that emits it; and every page's allowed set, for the
 *  cross-page check below. */
const emittedBy = new Map();
const allowedBy = new Map();

for (const file of walk(DIST)) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<[^>]*\sstyle="([^"]*)"[^>]*>/g)) {
    // An empty style="" is harmless noise from a framework; a declaration is not.
    if (m[1].trim() === '') continue;
    offenders.push({ file: relative(process.cwd(), file), decl: m[1].slice(0, 70) });
  }

  // The attribute sweep above misses a whole second category: a `<style>`
  // ELEMENT whose content Astro forgot to hash. `transition:name` shipped
  // exactly that — 1.5 MB of CSS the browser refused on every page, with all
  // eight gates green, because nothing compared the emitted styles against the
  // policy that governs them.
  const csp = CSP_META.exec(html)?.[1];
  if (!csp) continue;
  const rel = relative(process.cwd(), file);
  allowedBy.set(rel, new Set(csp.match(/'sha256-[^']+'/g)?.map((h) => h.slice(1, -1)) ?? []));
  for (const m of html.matchAll(STYLE_EL)) {
    const hash = sha256(m[1]);
    if (!emittedBy.has(hash)) emittedBy.set(hash, { file: rel, head: m[1].slice(0, 70) });
    if (!csp.includes(hash)) unhashed.push({ file: rel, hash, head: m[1].slice(0, 70) });
  }
}

// A meta CSP is applied when the document PARSES. `<ClientRouter />` swaps
// without reparsing, so the policy in force stays the one from the page the
// visitor started on. A style that only some pages carry is therefore refused
// on arrival from any page that lacked it — invisible to the per-page check
// above, because on a hard load that page allows its own style just fine.
//
// `/apps` hit this: it alone carried ShAppCard's scoped CSS, so soft-navigating
// there from a detail page silently dropped the stretched-link `::after` (the
// whole-card click target) and unhid `.sr-only` text.
const universal = [...emittedBy.keys()].filter((h) =>
  [...allowedBy.values()].every((s) => s.has(h)),
);
const pageSpecific = [...emittedBy.keys()].filter((h) => !universal.includes(h));

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

if (pageSpecific.length > 0) {
  console.error(
    `check-no-inline-styles — ${pageSpecific.length} <style> element(s) that only SOME`,
  );
  console.error("pages allow. A ClientRouter swap keeps the origin page's policy, so arriving");
  console.error('at the page carrying these from a page without them gets them refused:\n');
  for (const hash of pageSpecific) {
    const { file, head } = emittedBy.get(hash) ?? {};
    const short = [...allowedBy].filter(([, s]) => !s.has(hash)).length;
    console.error(`  ✗ ${file}\n      ${hash}\n      ${JSON.stringify(head)}`);
    console.error(`      refused when arriving from ${short} of ${allowedBy.size} pages`);
  }
  console.error("\n  Emit the CSS as an external stylesheet instead — style-src 'self' covers it");
  console.error("  on every page with no hash at all (build.inlineStylesheets: 'never').");
  process.exitCode = 1;
}

if (offenders.length === 0 && unhashed.length === 0 && pageSpecific.length === 0) {
  console.log(
    `check-no-inline-styles — OK (no style attributes; ${universal.length} <style> hash(es), ` +
      `allowed on all ${allowedBy.size} pages)`,
  );
}
