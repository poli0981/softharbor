<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)
     docs/05 §A2/§A3, docs/06 §5 — search input + grid controller. -->
<script lang="ts">
  import MiniSearch from 'minisearch';
  import { onMount } from 'svelte';
  import { miniSearchOptions, type SearchDoc } from '../../lib/search';
  import { mountGrid, type GridHandle } from '../../lib/grid';
  import { query, sort, type SortOrder } from '../../lib/stores';

  interface Props {
    placeholder: string;
    label: string;
    loadingLabel: string;
    sortName: string;
    sortAdded: string;
    sortLabel: string;
  }
  const { placeholder, label, loadingLabel, sortName, sortAdded, sortLabel }: Props = $props();

  let value = $state('');
  let loading = $state(false);
  let input: HTMLInputElement | undefined = $state();

  let grid: GridHandle | null = null;
  let mini: MiniSearch<SearchDoc> | null = null;
  let indexPromise: Promise<void> | null = null;

  /**
   * The index is fetched on FIRST interaction, not on mount (docs/05 §A2):
   * a visitor who never searches never pays for it, and facet filtering works
   * without it because the facets come from the DOM (§A3).
   */
  function loadIndex(): Promise<void> {
    indexPromise ??= (async () => {
      loading = true;
      try {
        const res = await fetch('/search-index.json');
        mini = MiniSearch.loadJSON<SearchDoc>(await res.text(), miniSearchOptions as never);
      } catch {
        // Offline or blocked: leave `mini` null so search stays inert and the
        // facet filters keep working, rather than emptying the grid.
        indexPromise = null;
      } finally {
        loading = false;
      }
    })();
    return indexPromise;
  }

  async function run(raw: string): Promise<void> {
    const q = raw.trim();
    query.set(q);
    if (q.length === 0) {
      grid?.setSearchHits(null); // empty query constrains nothing
      return;
    }
    await loadIndex();
    if (!mini) return;
    grid?.setSearchHits(new Set(mini.search(q).map((r) => String(r.id))));
  }

  function onInput(e: Event): void {
    value = (e.currentTarget as HTMLInputElement).value;
    void run(value);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (value !== '') {
        value = '';
        void run('');
      } else {
        input?.blur();
      }
    }
  }

  /** `/` focuses search from anywhere (docs/06 §9). */
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

  onMount(() => {
    grid = mountGrid();
    grid?.apply();
    document.addEventListener('keydown', onGlobalKeydown);
    return () => {
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
      class="bg-sh-surface border-sh-border w-full rounded-[var(--radius-card)] border-2 px-4 py-3"
      {value}
      oninput={onInput}
      onkeydown={onKeydown}
      onfocus={() => void loadIndex()}
    />
    {#if loading}
      <span
        class="text-sh-muted absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[var(--text-badge)]"
        >{loadingLabel}</span
      >
    {/if}
  </div>

  <label class="sr-only" for="sh-sort">{sortLabel}</label>
  <select
    id="sh-sort"
    class="bg-sh-surface border-sh-border rounded-[var(--radius-card)] border-2 px-3 py-3"
    onchange={(e) => sort.set((e.currentTarget as HTMLSelectElement).value as SortOrder)}
  >
    <option value="name">{sortName}</option>
    <option value="added">{sortAdded}</option>
  </select>
</div>

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
