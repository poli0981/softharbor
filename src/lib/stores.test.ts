// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { afterEach, describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  categories,
  clearAll,
  hasActiveFilters,
  platforms,
  pricing,
  query,
  toggleFacet,
} from './stores';

afterEach(() => {
  clearAll();
});

describe('cross-island stores (docs/05 §A3)', () => {
  it('toggles a facet value on and off without mutating the old set', () => {
    const before = categories.get();
    toggleFacet('categories', 'browser');
    expect([...categories.get()]).toEqual(['browser']);
    expect(before.size).toBe(0);
    toggleFacet('categories', 'browser');
    expect(categories.get().size).toBe(0);
  });

  it('counts active filters across all three facets', () => {
    toggleFacet('categories', 'browser');
    toggleFacet('platforms', 'linux');
    toggleFacet('pricing', 'free');
    toggleFacet('pricing', 'onetime');
    expect(activeFilterCount.get()).toBe(4);
  });

  it('treats a whitespace-only query as no query', () => {
    query.set('   ');
    expect(hasActiveFilters.get()).toBe(false);
    query.set(' gimp ');
    expect(hasActiveFilters.get()).toBe(true);
  });

  it('"Clear all" clears the query too, not just the facets', () => {
    query.set('gimp');
    toggleFacet('platforms', 'linux');
    clearAll();
    expect(query.get()).toBe('');
    expect(platforms.get().size).toBe(0);
    expect(pricing.get().size).toBe(0);
    expect(hasActiveFilters.get()).toBe(false);
  });
});
