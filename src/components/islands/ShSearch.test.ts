// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// ShSearch — the search box and grid controller. The grid (src/lib/grid.ts)
// and the index download are stubbed, so these pin the island's own
// contract: debounce, the stale-result race, failure reporting, URL state and
// the keyboard. Real typing against the real index runs in Playwright
// (e2e/prefs-search.spec.ts).

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { mountGrid, type GridHandle } from '../../lib/grid';
import { loadSearchIndex, type SearchIndex } from '../../lib/searchIndex';
import { clearAll, platforms, query, sort } from '../../lib/stores';
import ShSearch from './ShSearch.svelte';

vi.mock('../../lib/grid', () => ({ mountGrid: vi.fn() }));
vi.mock('../../lib/searchIndex', () => ({ loadSearchIndex: vi.fn() }));

const PROPS = {
  placeholder: 'Search apps',
  label: 'Search',
  loadingLabel: 'Loading…',
  errorLabel: 'Search is unavailable right now.',
  sortLabel: 'Sort',
  sortName: 'A–Z',
  sortAdded: 'Newest',
  sortRelevance: 'Relevance',
};

let grid: { [K in keyof GridHandle]: Mock<GridHandle[K]> };
let app: Record<string, unknown> | undefined;

const index = (...ids: string[]): SearchIndex =>
  ({ search: vi.fn(() => ids.map((id) => ({ id }))) }) as unknown as SearchIndex;

function start(url = '/apps'): HTMLInputElement {
  history.replaceState(null, '', url);
  const target = document.createElement('div');
  document.body.appendChild(target);
  app = mount(ShSearch, { target, props: PROPS });
  flushSync();
  return document.querySelector<HTMLInputElement>('#sh-search')!;
}

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const key = (el: EventTarget, k: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  grid = {
    setSearchHits: vi.fn<GridHandle['setSearchHits']>(),
    apply: vi.fn<GridHandle['apply']>(),
    destroy: vi.fn<GridHandle['destroy']>(),
  };
  vi.mocked(mountGrid).mockReturnValue(grid);
  vi.mocked(loadSearchIndex).mockResolvedValue(index('gimp', 'krita'));
});

afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  clearAll();
  sort.set('name');
  delete document.body.dataset['shGate'];
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('ShSearch', () => {
  it('waits for typing to settle, then ranks the grid and switches to relevance', async () => {
    const input = start();
    type(input, 'gim');
    type(input, 'gimp');
    await vi.advanceTimersByTimeAsync(100);
    expect(grid.setSearchHits).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    expect(query.get()).toBe('gimp');
    expect(grid.setSearchHits).toHaveBeenCalledTimes(1);
    expect(grid.setSearchHits).toHaveBeenLastCalledWith(['gimp', 'krita']);
    expect(sort.get()).toBe('relevance');
  });

  it('drops a result that arrives after the box was cleared', async () => {
    let arrive: (i: SearchIndex) => void = () => undefined;
    vi.mocked(loadSearchIndex).mockReturnValue(new Promise((r) => (arrive = r)));
    const input = start();

    type(input, 'g');
    await vi.advanceTimersByTimeAsync(150); // "g" is now waiting on the download
    key(input, 'Escape'); // …and is cleared before it lands
    arrive(index('gimp'));
    await vi.advanceTimersByTimeAsync(0);

    expect(input.value).toBe('');
    expect(grid.setSearchHits.mock.calls).toEqual([[null]]);
    expect(sort.get()).toBe('name');
  });

  it('says so when the index cannot load, and leaves the grid alone', async () => {
    vi.mocked(loadSearchIndex).mockRejectedValue(new Error('offline'));
    const input = start();
    type(input, 'gimp');
    await vi.advanceTimersByTimeAsync(150);
    flushSync();

    const status = document.getElementById('sh-search-status');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent).toBe(PROPS.errorLabel);
    expect(input.getAttribute('aria-describedby')).toBe('sh-search-status');
    expect(grid.setSearchHits).not.toHaveBeenCalled();
  });

  it('restores a shared view, keeping a deliberately chosen order', async () => {
    const input = start('/apps?q=gimp&platform=linux&sort=added');
    expect(platforms.get()).toEqual(new Set(['linux']));
    expect(input.value).toBe('gimp');
    expect(grid.apply).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(0);
    expect(grid.setSearchHits).toHaveBeenLastCalledWith(['gimp', 'krita']);
    expect(sort.get()).toBe('added');
  });

  it('writes the settled view to the URL, keeping the fragment', async () => {
    const input = start('/apps#search');
    type(input, 'trinh duyet');
    await vi.advanceTimersByTimeAsync(150 + 300);
    expect(location.search).toBe('?q=trinh+duyet');
    expect(location.hash).toBe('#search');
  });

  it('empties the box when something else clears the query', async () => {
    const input = start();
    type(input, 'gimp');
    await vi.advanceTimersByTimeAsync(150);
    clearAll();
    flushSync();
    expect(input.value).toBe('');
  });

  it('focuses on "/", except from another field or behind the legal gate', () => {
    const input = start();
    const other = document.body.appendChild(document.createElement('textarea'));

    key(document, '/');
    expect(document.activeElement).toBe(input);

    other.focus();
    key(other, '/');
    expect(document.activeElement).toBe(other);

    other.blur();
    document.body.dataset['shGate'] = 'open';
    key(document, '/');
    expect(document.activeElement).not.toBe(input);
  });

  it('Escape on an empty box gives focus back to the page', () => {
    const input = start();
    input.focus();
    key(input, 'Escape');
    expect(document.activeElement).not.toBe(input);
  });
});
