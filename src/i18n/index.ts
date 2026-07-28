// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/07 §3 — typed dictionary lookup. EN is the source of truth for keys.

import en from './en.json';
import vi from './vi.json';
import { type Locale } from '../lib/locale';

// Routing helpers live in src/lib/locale.ts (no dictionary import) so islands
// can use them without bundling every string; re-exported here so callers have
// one place to import from.
export { localeFromPath, localePair, localePath, type Locale } from '../lib/locale';

/** Key union derived from en.json — a typo is a compile error, not a blank. */
export type Key = keyof typeof en;

const dict: Record<Locale, Record<Key, string>> = { en, vi };

export function t(locale: Locale, key: Key, vars: Record<string, string | number> = {}): string {
  // The `?? dict.en[key]` fallback is belt-and-braces only: CI fails the build
  // on any key present in one dictionary and not the other (docs/07 §3), so
  // this should be unreachable in a shipped build.
  let s: string = dict[locale][key] ?? dict.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
