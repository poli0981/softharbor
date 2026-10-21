<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)
     docs/06 §5 — facets. Desktop: side panel; mobile: bottom sheet. Native
     <dialog> so focus trapping and Esc come from the platform (docs/06 §9). -->
<script lang="ts">
  import { onMount } from 'svelte';
  // Imported without the `$` prefix — Svelte reserves it, and `$name` below is
  // what auto-subscribes to these atoms (see src/lib/stores.ts).
  import {
    activeFilterCount,
    categories,
    hasActiveFilters,
    platforms,
    pricing,
    visibleCount,
    clearAll,
    toggleFacet,
    type Facet,
  } from '../../lib/stores';

  interface Option {
    value: string;
    label: string;
  }
  interface Props {
    /** Button text AND the dialog's accessible name ("Filters"). */
    openLabel: string;
    clearLabel: string;
    /** "Show {n} apps" (plural "other") and "Show {n} app" (plural "one"). */
    showLabel: string;
    showLabelOne: string;
    headings: { categories: string; platforms: string; pricing: string };
    options: { categories: Option[]; platforms: Option[]; pricing: Option[] };
  }
  const { openLabel, clearLabel, showLabel, showLabelOne, headings, options }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  /** Resolved on mount from <html lang>; SSR renders the "other" form. */
  let rules: Intl.PluralRules | null = $state(null);
  let numbers: Intl.NumberFormat | null = $state(null);

  // Re-read on every store change so checkboxes reflect an external clearAll().
  const selection = $derived(
    new Set([
      ...[...$categories].map((v) => `categories:${v}`),
      ...[...$platforms].map((v) => `platforms:${v}`),
      ...[...$pricing].map((v) => `pricing:${v}`),
    ]),
  );
  const isOn = (facet: Facet, value: string): boolean => selection.has(`${facet}:${value}`);

  const showText = $derived(
    (rules?.select($visibleCount) === 'one' ? showLabelOne : showLabel).replaceAll(
      '{n}',
      numbers ? numbers.format($visibleCount) : String($visibleCount),
    ),
  );

  const groups: Array<{ facet: Facet; heading: string; items: Option[] }> = $derived([
    { facet: 'categories', heading: headings.categories, items: options.categories },
    { facet: 'platforms', heading: headings.platforms, items: options.platforms },
    { facet: 'pricing', heading: headings.pricing, items: options.pricing },
  ]);

  onMount(() => {
    const lang = document.documentElement.lang || 'en';
    rules = new Intl.PluralRules(lang);
    numbers = new Intl.NumberFormat(lang);
  });
</script>

<button
  type="button"
  class="bg-sh-surface border-sh-border rounded-[var(--radius-card)] border px-4 py-3"
  aria-haspopup="dialog"
  onclick={() => dialog?.showModal()}
>
  {openLabel}
  {#if $activeFilterCount > 0}
    <span class="sh-pill bg-sh-accent text-sh-accent-ink ml-2">{$activeFilterCount}</span>
  {/if}
</button>

<dialog bind:this={dialog} class="sh-sheet" aria-labelledby="sh-filters-title">
  <form method="dialog" class="flex h-full flex-col gap-6">
    <h2 id="sh-filters-title" class="font-display text-[length:var(--text-h2)] font-semibold">
      {openLabel}
    </h2>
    {#each groups as group (group.facet)}
      <fieldset>
        <legend class="font-display text-[length:var(--text-h3)] font-semibold">
          {group.heading}
        </legend>
        <div class="mt-3 flex flex-col gap-2">
          {#each group.items as item (item.value)}
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isOn(group.facet, item.value)}
                onchange={() => toggleFacet(group.facet, item.value)}
              />
              {item.label}
            </label>
          {/each}
        </div>
      </fieldset>
    {/each}

    <footer class="mt-auto flex gap-3 pt-4">
      <button
        type="button"
        class="border-sh-border rounded-[var(--radius-card)] border px-4 py-2"
        disabled={!$hasActiveFilters}
        onclick={clearAll}>{clearLabel}</button
      >
      <!-- The visible text IS the accessible name ("Show 42 apps"). It used to
           carry aria-label="Close filters", which hid the count from screen
           readers and broke WCAG 2.5.3 Label in Name for voice control. -->
      <button
        type="submit"
        class="bg-sh-accent text-sh-accent-ink border-sh-border ml-auto rounded-[var(--radius-card)] border px-4 py-2 font-medium"
      >
        {showText}
      </button>
    </footer>
  </form>
</dialog>

<style>
  .sh-sheet {
    margin: 0 0 0 auto; /* right-side panel on desktop */
    height: 100dvh;
    max-height: 100dvh;
    width: min(24rem, 100vw);
    max-width: 100vw;
    border: 1px solid var(--sh-border);
    background: var(--sh-surface);
    color: var(--sh-ink);
    padding: 1.5rem;
    overflow-y: auto;
  }
  .sh-sheet::backdrop {
    background: rgb(0 0 0 / 0.5);
  }

  /* Mobile: bottom sheet (docs/06 §5). */
  @media (width < 40rem) {
    .sh-sheet {
      margin: auto 0 0 0;
      height: auto;
      max-height: 80dvh;
      width: 100vw;
      border-radius: var(--radius-card) var(--radius-card) 0 0;
    }
  }

  /* Touch targets ≥ 44px (docs/06 §8). */
  label {
    min-height: 44px;
  }
</style>
