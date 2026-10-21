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
// It never writes `el.style.*` and never needs to: hiding is the `hidden`
// attribute and ordering is a real DOM move. (An earlier version set
// `el.style.order`; whatever broke it, nodes moved with insertBefore keep
// working regardless of style or CSP, and keep tab order matching the
// visual order.)
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

/**
 * Locale-correct "N apps". The server leaves one template per plural category
 * on the count element (`data-count-one`, `data-count-other`); the island
 * picks with Intl.PluralRules and formats the number with Intl.NumberFormat,
 * exactly as the server did — before v1.1 the client wrote `String(n)` into a
 * single "{n} apps" template, so one result read "1 apps" and the number lost
 * its locale formatting after the first keystroke.
 */
export function formatCount(el: HTMLElement, n: number, lang: string): string {
  const category = new Intl.PluralRules(lang).select(n);
  const template =
    el.dataset[`count${category[0]?.toUpperCase() ?? ''}${category.slice(1)}`] ??
    el.dataset['countOther'] ??
    '{n}';
  return template.replaceAll('{n}', new Intl.NumberFormat(lang).format(n));
}

export interface GridHandle {
  /**
   * Feed in search results in RANK order (MiniSearch's result order) —
   * `null` restores "query not constraining".
   */
  setSearchHits(hits: Iterable<string> | null): void;
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
  let searchRank: ReadonlyMap<string, number> | undefined;

  // The count and empty-state are SERVER-rendered with the true total, so a
  // no-JS visitor sees a correct number. We only rewrite them here, using the
  // localized templates the server left behind — the island never needs to
  // know about locales (docs/07 §3).
  const countEl = doc.querySelector<HTMLElement>(COUNT_SELECTOR);
  const emptyEl = doc.querySelector<HTMLElement>(EMPTY_SELECTOR);
  const lang = doc.documentElement.lang || 'en';

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
      searchRank,
    );
    const shown = new Set(visible);

    for (const card of cards) card.el.hidden = !shown.has(card.slug);

    // Cards carry no entrance animation — only hover transitions — and every
    // control that drives this (search box, sort, filter sheet) lives outside
    // the grid, so moving nodes costs no focus and no motion.
    reorder(
      grid,
      visible.flatMap((slug) => bySlug.get(slug) ?? []),
    );

    visibleCount.set(visible.length);

    const text = countEl ? formatCount(countEl, visible.length, lang) : '';
    // Writing identical text into an aria-live region still re-announces it.
    if (countEl && countEl.textContent !== text) countEl.textContent = text;
    // Only reveal the empty state once filtering actually produced nothing —
    // it must not flash while the index is still loading.
    if (emptyEl) emptyEl.hidden = visible.length > 0;
  }

  // `listen`, not `subscribe`: subscribe() calls back immediately, so mounting
  // used to run five full filter-and-sort passes before the first keystroke.
  const unsubs = [
    categories.listen(apply),
    platforms.listen(apply),
    pricing.listen(apply),
    sort.listen(apply),
    // An emptied query — the box cleared, or "Clear all" — must also drop the
    // cached hits, or the grid stays filtered by a search nobody sees.
    query.listen((q) => {
      if (q.trim() === '' && searchHits !== null) {
        searchHits = null;
        searchRank = undefined;
        apply();
      }
    }),
  ];

  return {
    setSearchHits(hits) {
      if (hits === null) {
        searchHits = null;
        searchRank = undefined;
      } else {
        const ordered = [...hits];
        searchHits = new Set(ordered);
        searchRank = new Map(ordered.map((slug, i) => [slug, i]));
      }
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
