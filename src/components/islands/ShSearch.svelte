<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)
     docs/05 §A2/§A3, docs/06 §5 — search input + grid controller. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { mountGrid, type GridHandle } from '../../lib/grid';
  import { loadSearchIndex } from '../../lib/searchIndex';
  import { categories, platforms, pricing, query, sort, type SortOrder } from '../../lib/stores';
  import { parseViewState, serializeViewState } from '../../lib/urlstate';

  interface Props {
    placeholder: string;
    label: string;
    loadingLabel: string;
    /** Shown when the index cannot be loaded; facet filters keep working. */
    errorLabel: string;
    sortLabel: string;
    sortName: string;
    sortAdded: string;
    sortRelevance: string;
  }
  const {
    placeholder,
    label,
    loadingLabel,
    errorLabel,
    sortLabel,
    sortName,
    sortAdded,
    sortRelevance,
  }: Props = $props();

  /** Typing settles before the index is queried and the grid reordered. */
  const SEARCH_DEBOUNCE_MS = 150;
  /** The URL is updated after the view stops changing, not per keystroke. */
  const URL_DEBOUNCE_MS = 300;

  let value = $state('');
  let loading = $state(false);
  let failed = $state(false);
  let input: HTMLInputElement | undefined = $state();

  let grid: GridHandle | null = null;
  /** Bumped per query; a result for an older query is dropped on arrival. */
  let seq = 0;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let urlTimer: ReturnType<typeof setTimeout> | undefined;
  /** Whether the visitor chose an order; if not, searching switches to relevance. */
  let userSorted = false;

  async function run(raw: string): Promise<void> {
    const q = raw.trim();
    query.set(q);
    const mine = ++seq;

    if (q.length === 0) {
      grid?.setSearchHits(null); // empty query constrains nothing
      if (!userSorted && sort.get() === 'relevance') sort.set('name');
      return;
    }

    loading = true;
    try {
      const index = await loadSearchIndex();
      // The race this guards: type "g", delete it before the index arrives,
      // and the late result for "g" used to land on an empty box and filter
      // the grid anyway.
      if (mine !== seq || q !== query.get()) return;
      failed = false;
      if (!userSorted && sort.get() === 'name') sort.set('relevance');
      grid?.setSearchHits(index.search(q).map((r) => String(r.id)));
    } catch {
      // Offline or blocked: say so, and leave the facets working rather than
      // emptying the grid. The next keystroke retries the download.
      if (mine === seq) failed = true;
    } finally {
      if (mine === seq) loading = false;
    }
  }

  function schedule(raw: string): void {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void run(raw), SEARCH_DEBOUNCE_MS);
  }

  function onInput(e: Event): void {
    value = (e.currentTarget as HTMLInputElement).value;
    schedule(value);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    if (value !== '') {
      value = '';
      clearTimeout(searchTimer);
      void run('');
    } else {
      input?.blur();
    }
  }

  function onSortChange(e: Event): void {
    userSorted = true;
    sort.set((e.currentTarget as HTMLSelectElement).value as SortOrder);
  }

  /** `/` focuses search from anywhere on /apps (docs/06 §9). */
  function onGlobalKeydown(e: KeyboardEvent): void {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    // Never steal the key from a field the user is typing in...
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    // ...and never reach through the legal gate: a shortcut that scrolls or
    // focuses content behind an un-accepted modal defeats the focus trap
    // (docs/06 §9, docs/14 Part 2).
    if (document.body.dataset['shGate'] === 'open') return;
    e.preventDefault();
    input?.focus();
  }

  function writeUrl(): void {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const next =
        location.pathname +
        serializeViewState({
          q: query.get(),
          categories: [...categories.get()],
          platforms: [...platforms.get()],
          pricing: [...pricing.get()],
          // An automatic relevance order is implied by `q`; only a deliberate
          // choice belongs in a shared link.
          sort: userSorted ? sort.get() : null,
        }) +
        location.hash;
      if (next !== location.pathname + location.search + location.hash) {
        history.replaceState(history.state, '', next);
      }
    }, URL_DEBOUNCE_MS);
  }

  onMount(() => {
    grid = mountGrid();

    // Restore a shared / reloaded / back-navigated view.
    const state = parseViewState(location.search);
    categories.set(new Set(state.categories));
    platforms.set(new Set(state.platforms));
    pricing.set(new Set(state.pricing));
    if (state.sort) {
      userSorted = true;
      sort.set(state.sort);
    }
    grid?.apply();
    if (state.q) {
      value = state.q;
      void run(state.q);
    }

    // The welcome page's search field is a plain link to /apps#search.
    if (location.hash === '#search') input?.focus();

    const unsubs = [
      // "Clear all" (or anything else) emptying the query empties the box too.
      query.listen((q) => {
        if (q === '' && value !== '') value = '';
        writeUrl();
      }),
      categories.listen(writeUrl),
      platforms.listen(writeUrl),
      pricing.listen(writeUrl),
      sort.listen(writeUrl),
    ];

    document.addEventListener('keydown', onGlobalKeydown);
    return () => {
      clearTimeout(searchTimer);
      clearTimeout(urlTimer);
      for (const off of unsubs) off();
      document.removeEventListener('keydown', onGlobalKeydown);
      grid?.destroy();
    };
  });
</script>

<div class="flex flex-wrap items-center gap-3">
  <div class="relative min-w-0 flex-1">
    <label class="sr-only" for="sh-search">{label}</label>
    <input
      id="sh-search"
      bind:this={input}
      {placeholder}
      type="search"
      autocomplete="off"
      spellcheck="false"
      enterkeyhint="search"
      class="bg-sh-surface border-sh-border w-full rounded-[var(--radius-card)] border px-4 py-3"
      {value}
      oninput={onInput}
      onkeydown={onKeydown}
      onfocus={() => void loadSearchIndex().catch(() => undefined)}
      aria-describedby={failed ? 'sh-search-status' : undefined}
    />
    {#if loading}
      <span
        class="text-sh-muted text-badge absolute top-1/2 right-3 -translate-y-1/2 font-mono"
        aria-hidden="true">{loadingLabel}</span
      >
    {/if}
  </div>

  <label class="sr-only" for="sh-sort">{sortLabel}</label>
  <select
    id="sh-sort"
    class="bg-sh-surface border-sh-border rounded-[var(--radius-card)] border px-3 py-3"
    value={$sort}
    onchange={onSortChange}
  >
    {#if $query !== '' || $sort === 'relevance'}
      <option value="relevance">{sortRelevance}</option>
    {/if}
    <option value="name">{sortName}</option>
    <option value="added">{sortAdded}</option>
  </select>
</div>

{#if failed}
  <p id="sh-search-status" class="text-sh-muted text-small mt-2" role="status">{errorLabel}</p>
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
