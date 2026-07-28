// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/05 §A3 — cross-island state. Islands are leaf components and never
// import one another (docs/10 §2); ShSearch and ShFilterSheet coordinate only
// through these atoms.
//
// `nanostores` alone — there is no @nanostores/svelte package, and none is
// needed: an atom already satisfies Svelte's store contract (D15, docs/01 §2).
//
// NAMING: exported WITHOUT the `$` prefix nanostores docs use, because Svelte
// reserves `$` for store auto-subscription — `import { $query }` is a compile
// error (`dollar_prefix_invalid`). Declaring `query` here is what lets a
// component write `$query` to read the value reactively. The two conventions
// collide head-on; this is the side that has to give.

import { atom, computed } from 'nanostores';

export type SortOrder = 'name' | 'added';
export type Facet = 'categories' | 'platforms' | 'pricing';

export const query = atom<string>('');
export const categories = atom<ReadonlySet<string>>(new Set());
export const platforms = atom<ReadonlySet<string>>(new Set());
export const pricing = atom<ReadonlySet<string>>(new Set());
export const sort = atom<SortOrder>('name');

/** Number of cards currently visible; the grid writes it, the toolbar reads it. */
export const visibleCount = atom<number>(0);

const FACETS = { categories, platforms, pricing } as const;

/** Toggle one value within a facet (OR semantics live in the filter, §A3). */
export function toggleFacet(facet: Facet, value: string): void {
  const store = FACETS[facet];
  const next = new Set(store.get());
  if (!next.delete(value)) next.add(value);
  store.set(next);
}

export function clearAll(): void {
  query.set('');
  for (const store of Object.values(FACETS)) store.set(new Set());
}

/** Drives the "N active" chip on the filter button (docs/06 §5). */
export const activeFilterCount = computed(
  [categories, platforms, pricing],
  (c, p, pr) => c.size + p.size + pr.size,
);

export const hasActiveFilters = computed(
  [activeFilterCount, query],
  (n, q) => n > 0 || q.trim().length > 0,
);
