// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Resolves an app's `logo` field (docs/04 §2) to inline SVG markup.
//
// Three forms, in order of preference:
//   simple-icons:<name>  the brand's real mark, from the vendored Iconify set
//   local:<file>.svg     a vendor-official asset in src/assets/logos/
//   monogram             no brand mark is available — render the initials
//
// Why `monogram` exists (D23): most of the catalogue is small open-source
// desktop software that Simple Icons does not carry, and docs/14 §3d only
// sanctions two logo sources — Simple Icons, or the vendor's own official
// brand assets. Inventing or scraping a mark is not an option, so the honest
// answer is to render no mark at all. `monogram` says that in the data
// instead of leaving a `local:` reference dangling, which would be
// indistinguishable from an asset someone forgot to commit.
//
// Server-only, like ./icon.ts: it runs during `astro build` and reads from
// disk. Never import it from an island.

import { readFileSync } from 'node:fs';
import { iconSvg } from './icon';

const LOGOS_DIR = new URL('../assets/logos/', import.meta.url);

export class UnknownLogoError extends Error {}

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const renderAttrs = (attrs: Record<string, string>): string =>
  Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v.replace(/"/g, '&quot;')}"`)
    .join('');

/**
 * Up to two display characters for an app with no brand mark.
 *
 * First letter of each of the first two words, or the first two characters of
 * a single-word name. Diacritics are folded so Vietnamese names cannot emit a
 * combining mark on its own.
 */
export function initials(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

  // Destructured rather than indexed: docs/10 §1 bans non-null assertions
  // outside tests, and TypeScript cannot see that `filter(Boolean)` left
  // anything behind.
  const [first, second] = words;
  if (!first) return '?';
  if (!second) return first.slice(0, 2);
  return first.slice(0, 1) + second.slice(0, 1);
}

/**
 * A neutral tile carrying the app's initials.
 *
 * Everything is `currentColor` and plain SVG presentation attributes — no
 * `style=` anywhere, because CSP `style-src` has neither `unsafe-inline` nor
 * `unsafe-hashes`, so a browser would silently drop it (see D20 and
 * `pnpm check:styles`).
 */
function monogramSvg(name: string, attrs: Record<string, string>): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${renderAttrs(attrs)}>` +
    `<rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.4"/>` +
    `<text x="12" y="12" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="600" fill="currentColor">${escapeXml(initials(name))}</text>` +
    `</svg>`
  );
}

/**
 * Returns inline `<svg>` markup for any `logo` value.
 *
 * Throws rather than rendering a blank, for the same reason `iconSvg` does: a
 * logo that cannot be resolved should fail the build next to the entry that
 * caused it, not ship as an invisible gap.
 */
export function logoSvg(spec: string, name: string, attrs: Record<string, string> = {}): string {
  if (spec === 'monogram') return monogramSvg(name, attrs);

  if (spec.startsWith('local:')) {
    const file = spec.slice('local:'.length);
    let body: string;
    try {
      body = readFileSync(new URL(file, LOGOS_DIR), 'utf8');
    } catch {
      // `validate:data` (L2) catches this first and names the offending file;
      // this is the backstop for a build run without the gate.
      throw new UnknownLogoError(`Logo asset "src/assets/logos/${file}" not found`);
    }
    // Re-emit the root tag so callers control sizing and a11y the same way
    // they do for the other two forms, rather than inheriting whatever the
    // vendor's file happened to declare.
    const inner = body
      .replace(/<\?xml[\s\S]*?\?>/g, '')
      .replace(/<!DOCTYPE[\s\S]*?>/g, '')
      .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '');
    const viewBox = /viewBox="([^"]+)"/.exec(body)?.[1] ?? '0 0 24 24';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${renderAttrs(attrs)}>${inner}</svg>`;
  }

  return iconSvg(spec, attrs);
}
