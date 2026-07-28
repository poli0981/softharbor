// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/07 §2/§5 — locale ROUTING, deliberately separate from src/i18n/index.ts.
//
// That module imports both dictionaries at the top level, so any island
// importing a helper from it would bundle all ~68 strings. These functions are
// pure path arithmetic with no data, so islands can use them for free.
// src/i18n/index.ts re-exports them, keeping one implementation.

export type Locale = 'en' | 'vi';
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Normalise a build-time pathname to the URL we actually publish.
 *
 * With `build.format: 'file'` (required by the trailing-slash fix, docs/02 §4)
 * `Astro.url.pathname` carries the emitted FILE name — `/apps.html`,
 * `/legal/disclaimer.html`. Feeding that straight into canonical and hreflang
 * shipped 52 pages whose canonical disagreed with both the sitemap and the URL
 * being served (found in M4). Everything user-facing must go through here.
 */
export function canonicalPath(pathname: string): string {
  const stripped = pathname
    .replace(/\/index\.html$/, '/')
    .replace(/\.html$/, '')
    .replace(/\/$/, '');
  return stripped === '' ? '/' : stripped;
}

/** `en` → `/apps`, `vi` → `/vi/apps`. Slugs never localise. */
export function localePath(locale: Locale, path: string): string {
  const clean = path === '/' ? '' : path;
  return locale === DEFAULT_LOCALE ? clean || '/' : `/vi${clean}`;
}

export function localeFromPath(pathname: string): Locale {
  return pathname === '/vi' || pathname.startsWith('/vi/') ? 'vi' : 'en';
}

/**
 * Both directions of the EN⇄VI pair for a path in EITHER locale.
 *
 * Single source for the language switcher's href AND the hreflang alternates,
 * so the two can never disagree — docs/07 §5 requires them to be equal.
 */
export function localePair(pathname: string): Record<Locale, string> {
  const clean = canonicalPath(pathname);
  const bare = clean === '/vi' ? '/' : clean.replace(/^\/vi(?=\/)/, '') || '/';
  return { en: localePath('en', bare), vi: localePath('vi', bare) };
}
