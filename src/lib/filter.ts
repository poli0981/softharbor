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
 * Sort comparator.
 *
 * `name` collates on the NORMALIZED name so Vietnamese entries order the same
 * way in both locales, rather than depending on the browser's collation for
 * diacritics (docs/07 §4).
 */
export function compareCards(a: CardFacets, b: CardFacets, order: SortOrder): number {
  if (order === 'added') {
    const byDate = b.added.localeCompare(a.added); // newest first
    if (byDate !== 0) return byDate;
  }
  return normalizeViet(a.name).localeCompare(normalizeViet(b.name));
}

export function sortCards(cards: readonly CardFacets[], order: SortOrder): CardFacets[] {
  return [...cards].sort((a, b) => compareCards(a, b, order));
}

/** Convenience for the grid: visible slugs, already in display order. */
export function visibleSlugs(
  cards: readonly CardFacets[],
  state: FilterState,
  order: SortOrder,
): string[] {
  return sortCards(filterCards(cards, state), order).map((c) => c.slug);
}
