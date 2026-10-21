// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/05 §A3 — the /apps view as a URL.
//
// Query, facets and sort round-trip through the query string, so a filtered
// view can be shared or bookmarked, survives a reload, and comes back on Back
// and on a language switch (ShLangSwitch carries `location.search` across).
// Before v1.1 none of it reached the URL.
//
// Pure functions over strings; ShSearch owns reading on mount and writing
// with history.replaceState (no history entry per keystroke).

import type { SortOrder } from './stores';

export interface ViewState {
  q: string;
  categories: string[];
  platforms: string[];
  pricing: string[];
  /** `null` = default order, not written to the URL. */
  sort: SortOrder | null;
}

const SORTS: readonly SortOrder[] = ['name', 'added', 'relevance'];
/** Facet values are slugs / enum members; anything else is noise, not state. */
const VALUE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_QUERY = 200;

/** Plain UTF-16 order, explicit (SonarCloud S2871). */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const list = (raw: string | null): string[] =>
  [
    ...new Set(
      (raw ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter((v) => VALUE.test(v)),
    ),
  ].sort(byCodeUnit);

export function parseViewState(search: string): ViewState {
  const p = new URLSearchParams(search);
  const sort = p.get('sort');
  return {
    q: (p.get('q') ?? '').trim().slice(0, MAX_QUERY),
    categories: list(p.get('cat')),
    platforms: list(p.get('platform')),
    pricing: list(p.get('pricing')),
    sort: SORTS.includes(sort as SortOrder) ? (sort as SortOrder) : null,
  };
}

/** `''` for the default view, otherwise `?…` with a stable key order. */
export function serializeViewState(s: ViewState): string {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set('q', s.q.trim().slice(0, MAX_QUERY));
  if (s.categories.length) p.set('cat', [...s.categories].sort(byCodeUnit).join(','));
  if (s.platforms.length) p.set('platform', [...s.platforms].sort(byCodeUnit).join(','));
  if (s.pricing.length) p.set('pricing', [...s.pricing].sort(byCodeUnit).join(','));
  if (s.sort && s.sort !== 'name') p.set('sort', s.sort);
  const out = p.toString();
  return out ? `?${out}` : '';
}
