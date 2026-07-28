// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/11 §2 — "OR-within/AND-across facets; clear-all; sort orders incl. VN names".

import { describe, expect, it } from 'vitest';
import { filterCards, sortCards, visibleSlugs, type CardFacets, type FilterState } from './filter';

const CARDS: CardFacets[] = [
  {
    slug: 'firefox',
    name: 'Firefox',
    categories: ['browser'],
    platforms: ['windows', 'macos', 'linux'],
    pricing: 'free',
    added: '2026-07-28',
  },
  {
    slug: '7-zip',
    name: '7-Zip',
    categories: ['file-management', 'utilities'],
    platforms: ['windows', 'linux'],
    pricing: 'free',
    added: '2026-07-20',
  },
  {
    slug: 'affinity',
    name: 'Affinity Photo',
    categories: ['graphics'],
    platforms: ['windows', 'macos'],
    pricing: 'onetime',
    added: '2026-07-25',
  },
  {
    slug: 'obsidian',
    name: 'Obsidian',
    categories: ['productivity'],
    platforms: ['windows', 'macos', 'linux'],
    pricing: 'free-onetime',
    added: '2026-07-25',
  },
  {
    slug: 'unikey',
    name: 'Ứng dụng gõ',
    categories: ['utilities'],
    platforms: ['windows'],
    pricing: 'free',
    added: '2026-07-10',
  },
];

const NONE: FilterState = {
  searchHits: null,
  categories: new Set(),
  platforms: new Set(),
  pricing: new Set(),
};
const state = (p: Partial<FilterState>): FilterState => ({ ...NONE, ...p });
const slugs = (s: FilterState) =>
  filterCards(CARDS, s)
    .map((c) => c.slug)
    .sort();

describe('facet composition (docs/05 §A3)', () => {
  it('no filters shows everything', () => {
    expect(filterCards(CARDS, NONE)).toHaveLength(CARDS.length);
  });

  it('OR within a facet', () => {
    expect(slugs(state({ pricing: new Set(['onetime', 'free-onetime']) }))).toEqual([
      'affinity',
      'obsidian',
    ]);
  });

  it('AND across facets', () => {
    // free AND macos — 7-zip is free but has no macOS build, so it drops.
    expect(slugs(state({ pricing: new Set(['free']), platforms: new Set(['macos']) }))).toEqual([
      'firefox',
    ]);
  });

  it('an empty facet means NO CONSTRAINT, not "match nothing"', () => {
    // The bug this guards: treating an empty Set as an impossible predicate
    // empties the grid the moment a user clears their last filter.
    expect(filterCards(CARDS, state({ categories: new Set() }))).toHaveLength(CARDS.length);
  });

  it('matches an app that has ANY of the selected categories, not all', () => {
    expect(slugs(state({ categories: new Set(['utilities']) }))).toEqual(['7-zip', 'unikey']);
  });

  it('intersects search hits with facets', () => {
    const s = state({ searchHits: new Set(['firefox', '7-zip']), pricing: new Set(['free']) });
    expect(slugs(s)).toEqual(['7-zip', 'firefox']);
    const narrower = state({ searchHits: new Set(['firefox']), platforms: new Set(['linux']) });
    expect(slugs(narrower)).toEqual(['firefox']);
  });

  it('null searchHits means "index not consulted", distinct from "no hits"', () => {
    expect(filterCards(CARDS, state({ searchHits: null }))).toHaveLength(CARDS.length);
    expect(filterCards(CARDS, state({ searchHits: new Set() }))).toHaveLength(0);
  });
});

describe('sort orders', () => {
  it('name sorts A–Z on the NORMALIZED name', () => {
    // "Ứng dụng gõ" must collate as "ung dung go" — after Obsidian, not in
    // some browser-specific position for Ứ (docs/07 §4).
    expect(sortCards(CARDS, 'name').map((c) => c.slug)).toEqual([
      '7-zip',
      'affinity',
      'firefox',
      'obsidian',
      'unikey',
    ]);
  });

  it('added sorts newest first', () => {
    expect(sortCards(CARDS, 'added').map((c) => c.slug)[0]).toBe('firefox');
  });

  it('added ties break by name, so the order is deterministic', () => {
    // affinity and obsidian share 2026-07-25.
    const order = sortCards(CARDS, 'added').map((c) => c.slug);
    expect(order.slice(1, 3)).toEqual(['affinity', 'obsidian']);
  });

  it('is a pure function — the input array is not mutated', () => {
    const before = CARDS.map((c) => c.slug);
    sortCards(CARDS, 'added');
    expect(CARDS.map((c) => c.slug)).toEqual(before);
  });
});

describe('visibleSlugs — filter then sort, in display order', () => {
  it('composes both', () => {
    expect(visibleSlugs(CARDS, state({ pricing: new Set(['free']) }), 'name')).toEqual([
      '7-zip',
      'firefox',
      'unikey',
    ]);
  });

  it('returns [] when nothing matches', () => {
    expect(
      visibleSlugs(
        CARDS,
        state({ pricing: new Set(['onetime']), platforms: new Set(['linux']) }),
        'name',
      ),
    ).toEqual([]);
  });
});
