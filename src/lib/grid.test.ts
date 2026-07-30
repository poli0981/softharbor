// @vitest-environment happy-dom
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Regression cover for the sort bug that reached production: the grid used to
// reorder with `el.style.order`, which CSP `style-src` refuses (D20), so the
// cards never moved. `check:styles` could not see it — the assignment only
// exists at runtime — and nothing here exercised the DOM, so it shipped green.

import { beforeEach, describe, expect, it } from 'vitest';
import { mountGrid } from './grid';
import { categories, platforms, pricing, query, sort, visibleCount } from './stores';

// Dates are chosen so "newest" and "A–Z" disagree. With any other fixture the
// reorder assertion below passes even when reordering does nothing at all.
const APPS = [
  { slug: 'vlc', name: 'VLC', added: '2026-07-03', pricing: 'free', cats: 'media' },
  { slug: 'anki', name: 'Anki', added: '2026-07-01', pricing: 'free', cats: 'productivity' },
  { slug: 'krita', name: 'Krita', added: '2026-07-02', pricing: 'free', cats: 'graphics' },
];

function build(): HTMLElement {
  document.body.innerHTML =
    `<div id="sh-grid">` +
    APPS.map(
      (a) =>
        `<article data-slug="${a.slug}" data-name="${a.name}" data-categories="${a.cats}"` +
        ` data-platforms="windows" data-pricing="${a.pricing}" data-added="${a.added}"></article>`,
    ).join('') +
    `</div><span id="sh-count" data-count-template="{n} apps"></span>` +
    `<p id="sh-empty" hidden></p>`;
  const grid = document.querySelector<HTMLElement>('#sh-grid');
  if (!grid) throw new Error('fixture did not build');
  return grid;
}

const domOrder = (grid: HTMLElement): string[] =>
  [...grid.querySelectorAll<HTMLElement>('[data-slug]')].map((el) => el.dataset['slug'] ?? '');

const visibleOrder = (grid: HTMLElement): string[] =>
  [...grid.querySelectorAll<HTMLElement>('[data-slug]')]
    .filter((el) => !el.hidden)
    .map((el) => el.dataset['slug'] ?? '');

describe('mountGrid', () => {
  beforeEach(() => {
    for (const s of [categories, platforms, pricing]) s.set(new Set<string>());
    query.set('');
    sort.set('name');
    visibleCount.set(0);
  });

  it('never writes an inline style — CSP would drop it silently', () => {
    const grid = build();
    const handle = mountGrid(document);
    sort.set('added');
    handle?.apply();

    for (const el of grid.querySelectorAll<HTMLElement>('[data-slug]')) {
      expect(el.getAttribute('style')).toBeNull();
    }
    handle?.destroy();
  });

  it('reorders the actual DOM nodes when the sort changes', () => {
    const grid = build();
    const handle = mountGrid(document);

    sort.set('name');
    expect(visibleOrder(grid)).toEqual(['anki', 'krita', 'vlc']);

    // Newest first — the assertion that would have caught the shipped bug.
    sort.set('added');
    expect(visibleOrder(grid)).toEqual(['vlc', 'krita', 'anki']);
    handle?.destroy();
  });

  it('leaves the DOM untouched when the order is already correct', () => {
    const grid = build();
    const handle = mountGrid(document);
    sort.set('name');
    const before = domOrder(grid);

    let mutations = 0;
    const obs = new MutationObserver((records) => {
      mutations += records.length;
    });
    obs.observe(grid, { childList: true });
    handle?.apply();
    obs.disconnect();

    expect(domOrder(grid)).toEqual(before);
    expect(mutations).toBe(0);
    handle?.destroy();
  });

  it('hides filtered-out cards and keeps the survivors in order', () => {
    const grid = build();
    const handle = mountGrid(document);
    handle?.setSearchHits(new Set(['vlc', 'krita']));

    expect(visibleOrder(grid)).toEqual(['krita', 'vlc']);
    expect(visibleCount.get()).toBe(2);
    handle?.destroy();
  });

  it('destroy() unhides everything and restores the server-rendered order', () => {
    const grid = build();
    const handle = mountGrid(document);
    handle?.setSearchHits(new Set(['krita']));
    expect(visibleOrder(grid)).toEqual(['krita']);

    handle?.destroy();
    expect(domOrder(grid)).toEqual(['vlc', 'anki', 'krita']);
    expect(visibleOrder(grid)).toEqual(['vlc', 'anki', 'krita']);
  });

  it('returns null off the grid pages', () => {
    document.body.innerHTML = '<main></main>';
    expect(mountGrid(document)).toBeNull();
  });
});
