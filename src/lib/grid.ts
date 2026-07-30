// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/05 §A3 — applies filter/sort results to the server-rendered grid.
//
// This is NOT an island. docs/02 §5 fixes the island count at six and requires
// a decision-log entry to add a seventh, so the DOM work lives in a plain
// module that ShSearch mounts. All decisions come from src/lib/filter.ts;
// this file only reads facets off the DOM, toggles `hidden`, and reorders the
// card nodes.
//
// It must never write `el.style.*`. CSP `style-src` carries hashes but neither
// `unsafe-inline` nor `unsafe-hashes` (D20), so the browser silently drops any
// inline style a script applies — and `pnpm check:styles` cannot catch it,
// because that scans the built HTML and this assignment only ever exists at
// runtime. Sorting shipped broken for exactly that reason: `el.style.order`
// was refused on every navigation and the grid never reordered.
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

/**
 * Puts `ordered` at the front of `grid`, in that order, with the fewest moves.
 *
 * Walks the desired sequence against the live child list and only calls
 * `insertBefore` when a node is not already where it belongs — so an unchanged
 * order costs zero DOM writes, which is the common case while typing. Cards
 * left out (the hidden ones) trail behind and keep their relative order.
 */
function reorder(grid: HTMLElement, ordered: readonly HTMLElement[]): void {
  let anchor = grid.firstElementChild;
  for (const el of ordered) {
    if (el === anchor) anchor = el.nextElementSibling;
    else grid.insertBefore(el, anchor);
  }
}

export interface GridHandle {
  /** Feed in search results; `null` restores "query not constraining". */
  setSearchHits(hits: ReadonlySet<string> | null): void;
  apply(): void;
  destroy(): void;
}

export function mountGrid(doc: Document = document): GridHandle | null {
  const found = doc.querySelector<HTMLElement>(GRID_SELECTOR);
  if (!found) return null; // not on /apps — nothing to drive
  // Re-bound with an explicit type: the null-check narrowing above does not
  // follow `found` into the closures below, and docs/10 §1 bans the `!` that
  // would otherwise paper over it.
  const grid: HTMLElement = found;

  const cards = readCards(grid);
  const bySlug = new Map(cards.map((c) => [c.slug, c.el]));
  /** Server-rendered order, restored by destroy(). */
  const initialOrder = cards.map((c) => c.el);
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

    for (const card of cards) card.el.hidden = !rank.has(card.slug);

    // Cards carry no entrance animation — only `.sh-lift` hover transitions —
    // and every control that drives this (search box, sort, filter sheet)
    // lives outside the grid, so moving nodes costs no focus and no motion.
    reorder(
      grid,
      visible.flatMap((slug) => bySlug.get(slug) ?? []),
    );

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
      for (const card of cards) card.el.hidden = false;
      reorder(grid, initialOrder);
    },
  };
}
