// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/05 §A3 — applies filter/sort results to the server-rendered grid.
//
// This is NOT an island. docs/02 §5 fixes the island count at six and requires
// a decision-log entry to add a seventh, so the DOM work lives in a plain
// module that ShSearch mounts. All decisions come from src/lib/filter.ts;
// this file only reads facets off the DOM and writes `hidden` / `order`.
//
// It never re-renders card CONTENT: the grid ships fully server-rendered, so a
// visitor with JS disabled sees every app (docs/03 §8, hard rule 1).

import { visibleSlugs, type CardFacets } from './filter';
import { categories, platforms, pricing, query, sort, visibleCount } from './stores';

const GRID_SELECTOR = '#sh-grid';
const CARD_SELECTOR = '[data-slug]';
const COUNT_SELECTOR = '#sh-count';
const EMPTY_SELECTOR = '#sh-empty';

const attrList = (el: HTMLElement, name: string): string[] =>
  (el.dataset[name] ?? '').split(' ').filter(Boolean);

function readCards(grid: HTMLElement): Array<CardFacets & { el: HTMLElement }> {
  return [...grid.querySelectorAll<HTMLElement>(CARD_SELECTOR)].map((el) => ({
    el,
    slug: el.dataset['slug'] ?? '',
    name: el.dataset['name'] ?? '',
    categories: attrList(el, 'categories'),
    platforms: attrList(el, 'platforms'),
    pricing: el.dataset['pricing'] ?? '',
    added: el.dataset['added'] ?? '',
  }));
}

export interface GridHandle {
  /** Feed in search results; `null` restores "query not constraining". */
  setSearchHits(hits: ReadonlySet<string> | null): void;
  apply(): void;
  destroy(): void;
}

export function mountGrid(doc: Document = document): GridHandle | null {
  const grid = doc.querySelector<HTMLElement>(GRID_SELECTOR);
  if (!grid) return null; // not on /apps — nothing to drive

  const cards = readCards(grid);
  let searchHits: ReadonlySet<string> | null = null;

  // The count and empty-state are SERVER-rendered with the true total, so a
  // no-JS visitor sees a correct number. We only rewrite them here, using the
  // localized template the server left behind — the island never needs to know
  // about locales (docs/07 §3).
  const countEl = doc.querySelector<HTMLElement>(COUNT_SELECTOR);
  const emptyEl = doc.querySelector<HTMLElement>(EMPTY_SELECTOR);
  const countTemplate = countEl?.dataset['countTemplate'] ?? '{n}';

  function apply(): void {
    const visible = visibleSlugs(
      cards,
      {
        searchHits,
        categories: categories.get(),
        platforms: platforms.get(),
        pricing: pricing.get(),
      },
      sort.get(),
    );
    const rank = new Map(visible.map((slug, i) => [slug, i]));

    for (const card of cards) {
      const i = rank.get(card.slug);
      if (i === undefined) {
        card.el.hidden = true;
      } else {
        card.el.hidden = false;
        // CSS order, not DOM moves: reordering nodes would drop focus and
        // restart the entrance animation on every keystroke.
        card.el.style.order = String(i);
      }
    }

    visibleCount.set(visible.length);

    if (countEl) countEl.textContent = countTemplate.replaceAll('{n}', String(visible.length));
    // Only reveal the empty state once filtering actually produced nothing —
    // it must not flash while the index is still loading.
    if (emptyEl) emptyEl.hidden = visible.length > 0;
  }

  const unsubs = [query, categories, platforms, pricing, sort].map((s) =>
    s.subscribe(() => apply()),
  );

  return {
    setSearchHits(hits) {
      searchHits = hits;
      apply();
    },
    apply,
    destroy() {
      for (const off of unsubs) off();
      for (const card of cards) {
        card.el.hidden = false;
        card.el.style.removeProperty('order');
      }
    },
  };
}
