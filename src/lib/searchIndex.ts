// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/05 §A2 — client-side loader for the prebuilt search index.
//
// Fetched on FIRST interaction, never on page load: a visitor who never
// searches never pays for it, and facet filtering works without it because
// the facets come from the DOM (§A3). MiniSearch itself is imported here, on
// demand, for the same reason — it used to ship in /apps' static bundle.
//
// One promise per page, shared by every caller, so a burst of keystrokes
// triggers one download. A failure clears the cache so the next interaction
// retries, and is reported (not swallowed) so the island can say search is
// unavailable instead of silently doing nothing.

import type MiniSearch from 'minisearch';
import { miniSearchOptions, type SearchDoc } from './searchOptions';

export const INDEX_URL = '/search-index.json';

export type SearchIndex = Pick<MiniSearch<SearchDoc>, 'search'>;

let pending: Promise<SearchIndex> | null = null;

export function loadSearchIndex(
  fetchImpl: (input: string) => Promise<Response> = (input) => fetch(input),
): Promise<SearchIndex> {
  pending ??= (async () => {
    const [{ default: MiniSearchCtor }, res] = await Promise.all([
      import('minisearch'),
      fetchImpl(INDEX_URL),
    ]);
    // An error page (404, an offline fallback) would make loadJSON throw a
    // parse error that says nothing about the actual cause.
    if (!res.ok) throw new Error(`search index: HTTP ${res.status}`);
    return MiniSearchCtor.loadJSON<SearchDoc>(await res.text(), miniSearchOptions as never);
  })();
  pending.catch(() => {
    pending = null;
  });
  return pending;
}

/** Test seam: forget the cached index. */
export function resetSearchIndex(): void {
  pending = null;
}
