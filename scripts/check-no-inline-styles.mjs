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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = join(process.cwd(), 'dist');

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

for (const file of walk(DIST)) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<[^>]*\sstyle="([^"]*)"[^>]*>/g)) {
    // An empty style="" is harmless noise from a framework; a declaration is not.
    if (m[1].trim() === '') continue;
    offenders.push({ file: relative(process.cwd(), file), decl: m[1].slice(0, 70) });
  }
}

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
} else {
  console.log('check-no-inline-styles — OK (no inline style attributes reach the browser)');
}
