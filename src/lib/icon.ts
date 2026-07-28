// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Build-time icon lookup.
//
// `unplugin-icons` resolves `~icons/set/name` at BUILD time from a static
// import specifier, which is exactly wrong for our logos: `logo` is a data
// field (docs/04 §2), so the icon name is only known per-entry. Rather than
// give up build-time inlining — hard rule 7 forbids any runtime third-party
// request — we read the same Iconify JSON sets `unplugin-icons` uses and
// inline the SVG body ourselves. Nothing is fetched at runtime either way.
//
// This module is server-only (it runs during `astro build`); it must never be
// imported from an island.

import lucide from '@iconify-json/lucide/icons.json' with { type: 'json' };
import simpleIcons from '@iconify-json/simple-icons/icons.json' with { type: 'json' };

interface IconSet {
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number }>;
  aliases?: Record<string, { parent: string }>;
}

const SETS: Record<string, IconSet> = {
  'simple-icons': simpleIcons as IconSet,
  lucide: lucide as IconSet,
};

export class UnknownIconError extends Error {}

/**
 * Returns inline `<svg>` markup for `set:name`.
 *
 * Throws rather than rendering a blank: a missing logo should fail the build
 * next to the entry that caused it, not ship as an invisible gap (docs/03 §2
 * has the same intent for `local:` assets).
 */
export function iconSvg(spec: string, attrs: Record<string, string> = {}): string {
  const [setName, iconName] = spec.split(':', 2);
  const set = setName ? SETS[setName] : undefined;
  if (!set || !iconName) throw new UnknownIconError(`Unknown icon set in "${spec}"`);

  const resolvedName = set.aliases?.[iconName]?.parent ?? iconName;
  const icon = set.icons[resolvedName];
  if (!icon) throw new UnknownIconError(`Icon "${spec}" not found in ${setName}`);

  const w = icon.width ?? set.width ?? 24;
  const h = icon.height ?? set.height ?? 24;
  const extra = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v.replace(/"/g, '&quot;')}"`)
    .join('');

  // No user input reaches this string: `spec` is schema-constrained and the
  // body comes from a vendored, versioned JSON set.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"${extra}>${icon.body}</svg>`;
}
