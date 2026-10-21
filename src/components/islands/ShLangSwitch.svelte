<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)
     docs/07 §2/§5 — EN | VI switcher plus the one-time suggestion banner. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { readLangPref, writeLangPref } from '../../lib/lang';
  import type { Locale } from '../../lib/locale';

  interface Props {
    /** The page's locale, resolved at build time. */
    locale: Locale;
    /**
     * Both directions of the EN⇄VI pair for this page — the SAME localePair()
     * result Base.astro writes into the hreflang alternates, so the switcher
     * and the alternates can never disagree (docs/07 §5). Server-rendered:
     * before v1.1 the island guessed `en` / `/vi` until it hydrated, so every
     * Vietnamese page shipped HTML marking English as current.
     */
    pair: Record<Locale, string>;
    label: string;
    /** Banner copy, always Vietnamese — it only ever shows to a VI speaker. */
    suggestText: string;
    suggestAccept: string;
    suggestDismiss: string;
  }
  const { locale, pair, label, suggestText, suggestAccept, suggestDismiss }: Props = $props();

  /**
   * Endonyms for assistive tech — each language named in itself, inside an
   * element with the matching `lang` so it is pronounced correctly. Invariant
   * across UI locales, so they are constants rather than dictionary entries.
   * They are APPENDED to the visible EN / VI (not an aria-label replacing it),
   * so voice-control users can still say what they see.
   */
  const names: Record<Locale, string> = { en: 'English', vi: 'Tiếng Việt' };

  /** Query and fragment carried across, so a filtered /apps view survives a switch. */
  let carry = $state('');
  let showSuggestion = $state(false);

  const hrefFor = (target: Locale): string => pair[target] + carry;

  function choose(target: Locale): void {
    writeLangPref(target);
    showSuggestion = false;
  }

  function dismiss(): void {
    // Dismissing records a choice too, so the banner never returns.
    writeLangPref('en');
    showSuggestion = false;
  }

  onMount(() => {
    carry = location.search + location.hash;
    // Suggestion banner, all three conditions required (docs/07 §2):
    // VI browser ∧ currently on EN ∧ no stored preference. There is NO
    // automatic redirect — bots and users always get the URL they asked for.
    showSuggestion =
      navigator.language.toLowerCase().startsWith('vi') &&
      locale === 'en' &&
      readLangPref() === null;
  });
</script>

<nav aria-label={label} class="sh-lang" data-testid="sh-lang-switch">
  {#if locale === 'vi'}
    <a
      href={hrefFor('en')}
      onclick={() => choose('en')}
      hreflang="en"
      lang="en"
      data-testid="sh-lang-en">EN<span class="sh-sr">{` — ${names.en}`}</span></a
    >
    <span aria-current="true" lang="vi">VI<span class="sh-sr">{` — ${names.vi}`}</span></span>
  {:else}
    <span aria-current="true" lang="en">EN<span class="sh-sr">{` — ${names.en}`}</span></span>
    <a
      href={hrefFor('vi')}
      onclick={() => choose('vi')}
      hreflang="vi"
      lang="vi"
      data-testid="sh-lang-vi">VI<span class="sh-sr">{` — ${names.vi}`}</span></a
    >
  {/if}
</nav>

{#if showSuggestion}
  <div
    class="sh-panel fixed inset-x-4 bottom-4 z-40 flex flex-wrap items-center gap-3 p-4 md:left-auto md:max-w-md"
    lang="vi"
    data-testid="sh-lang-suggest"
  >
    <p class="min-w-0 flex-1">{suggestText}</p>
    <a
      href={hrefFor('vi')}
      onclick={() => choose('vi')}
      class="bg-sh-accent text-sh-accent-ink border-sh-border rounded-[var(--radius-pill)] border px-3 py-2"
      >{suggestAccept}</a
    >
    <button
      type="button"
      onclick={dismiss}
      class="border-sh-border rounded-[var(--radius-pill)] border px-3 py-2"
      >{suggestDismiss}</button
    >
  </div>
{/if}

<style>
  /* Segmented EN | VI control: the current language is the filled segment. */
  .sh-lang {
    display: inline-flex;
    border: 1px solid var(--sh-border);
    border-radius: var(--radius-pill);
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: var(--text-badge);
  }
  .sh-lang > * {
    display: inline-flex;
    align-items: center;
    min-height: 2.25rem;
    padding: 0 0.75rem;
  }
  .sh-lang > [aria-current='true'] {
    background: var(--sh-ink);
    color: var(--sh-bg);
  }
  .sh-lang > a:hover {
    background: var(--sh-surface);
  }
  /* The endonym is read after the visible code ("VI — Tiếng Việt"), so the
     visible text stays part of the accessible name (WCAG 2.5.3). Its leading
     space is an expression in the markup: Svelte strips whitespace at the
     start of an element, which ran the two together ("VI— Tiếng Việt"). */
  .sh-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
