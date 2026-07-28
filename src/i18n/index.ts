// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/07 §3 — typed dictionary lookup. EN is the source of truth for keys.

import en from './en.json';
import vi from './vi.json';

export type Locale = 'en' | 'vi';
export const LOCALES: readonly Locale[] = ['en', 'vi'];
export const DEFAULT_LOCALE: Locale = 'en';

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

/** `en` → `/apps`, `vi` → `/vi/apps`. Slugs never localise (docs/07 §2). */
export function localePath(locale: Locale, path: string): string {
  const clean = path === '/' ? '' : path;
  return locale === DEFAULT_LOCALE ? clean || '/' : `/vi${clean}`;
}

/**
 * Both directions of the EN⇄VI pair for a path in EITHER locale.
 * Single source for the language switcher href and the hreflang alternates,
 * so the two can never disagree (docs/07 §5).
 */
export function localePair(pathname: string): Record<Locale, string> {
  const bare = pathname === '/vi' ? '/' : pathname.replace(/^\/vi(?=\/)/, '') || '/';
  return { en: localePath('en', bare), vi: localePath('vi', bare) };
}

export function localeFromPath(pathname: string): Locale {
  return pathname === '/vi' || pathname.startsWith('/vi/') ? 'vi' : 'en';
}
