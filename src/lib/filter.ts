// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/05 §A3 — filter composition and sort. Pure functions on plain data, so
// the actual logic is unit-testable without a DOM; src/lib/grid.ts is the thin
// layer that reads these facets off the cards and applies the result.

import { normalizeViet } from './normalize';
import type { SortOrder } from './stores';

/** Mirrors the data-* attributes ShAppCard renders (docs/06 §6). */
export interface CardFacets {
  slug: string;
  name: string;
  categories: readonly string[];
  platforms: readonly string[];
  pricing: string;
  added: string;
}

export interface FilterState {
  /** Slugs matching the query, or `null` when the query is empty / index unloaded. */
  searchHits: ReadonlySet<string> | null;
  categories: ReadonlySet<string>;
  platforms: ReadonlySet<string>;
  pricing: ReadonlySet<string>;
}

const intersects = (values: readonly string[], selected: ReadonlySet<string>): boolean =>
  values.some((v) => selected.has(v));

/**
 * OR within a facet, AND across facets — industry-standard faceting.
 *
 * An empty facet means "no constraint", NOT "match nothing": that is what
 * makes clearing a facet restore results instead of emptying the grid.
 */
export function matches(card: CardFacets, state: FilterState): boolean {
  if (state.searchHits !== null && !state.searchHits.has(card.slug)) return false;
  if (state.categories.size > 0 && !intersects(card.categories, state.categories)) return false;
  if (state.platforms.size > 0 && !intersects(card.platforms, state.platforms)) return false;
  if (state.pricing.size > 0 && !state.pricing.has(card.pricing)) return false;
  return true;
}

export function filterCards(cards: readonly CardFacets[], state: FilterState): CardFacets[] {
  return cards.filter((c) => matches(c, state));
}

/**
 * One collator for the whole module, pinned to `en`.
 *
 * `localeCompare()` with no locale collates by the VISITOR's browser locale:
 * in a Czech-locale browser "ch" sorts after "h", which moved 81 of the 326
 * cards (CherryTree, Chocolatey, …). Names are compared AFTER normalizeViet,
 * so Vietnamese diacritics are already folded and `en` rules are exactly
 * what we want in both UI locales (docs/07 §4). `numeric` puts "7-Zip"
 * before "10…" the way people read it.
 */
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** normalizeViet() per distinct name, computed once instead of per comparison. */
const sortKeys = new Map<string, string>();
function sortKey(name: string): string {
  let key = sortKeys.get(name);
  if (key === undefined) {
    key = normalizeViet(name);
    sortKeys.set(name, key);
  }
  return key;
}

/**
 * Sort comparator.
 *
 * - `name` collates on the NORMALIZED name, so Vietnamese entries order the
 *   same way in both locales.
 * - `added` is newest first, name as the tie-break.
 * - `relevance` follows the search ranking (`rank`: slug → position in
 *   MiniSearch's result list); unranked cards fall back to name.
 */
export function compareCards(
  a: CardFacets,
  b: CardFacets,
  order: SortOrder,
  rank?: ReadonlyMap<string, number>,
): number {
  if (order === 'added') {
    const byDate = b.added < a.added ? -1 : b.added > a.added ? 1 : 0; // newest first
    if (byDate !== 0) return byDate;
  } else if (order === 'relevance' && rank) {
    const ra = rank.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
  }
  return collator.compare(sortKey(a.name), sortKey(b.name));
}

export function sortCards(
  cards: readonly CardFacets[],
  order: SortOrder,
  rank?: ReadonlyMap<string, number>,
): CardFacets[] {
  return [...cards].sort((a, b) => compareCards(a, b, order, rank));
}

/** Convenience for the grid: visible slugs, already in display order. */
export function visibleSlugs(
  cards: readonly CardFacets[],
  state: FilterState,
  order: SortOrder,
  rank?: ReadonlyMap<string, number>,
): string[] {
  return sortCards(filterCards(cards, state), order, rank).map((c) => c.slug);
}
