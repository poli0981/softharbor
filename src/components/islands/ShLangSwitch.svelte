<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)
     docs/07 §2/§5 — EN | VI switcher plus the one-time suggestion banner. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { localeFromPath, localePair, type Locale } from '../../lib/locale';
  import { readLangPref, writeLangPref } from '../../lib/lang';

  interface Props {
    /** Banner copy, always Vietnamese — it only ever shows to a VI speaker. */
    suggestText: string;
    suggestAccept: string;
    suggestDismiss: string;
    label: string;
  }
  const { suggestText, suggestAccept, suggestDismiss, label }: Props = $props();

  let current = $state<Locale>('en');
  let pair = $state<Record<Locale, string>>({ en: '/', vi: '/vi' });
  let showSuggestion = $state(false);

  function sync(): void {
    current = localeFromPath(location.pathname);
    // Same helper the <link rel="alternate"> tags use, so the switcher href
    // and the hreflang alternate are guaranteed identical (docs/07 §5).
    pair = localePair(location.pathname);

    // Suggestion banner, all three conditions required (docs/07 §2):
    // VI browser ∧ currently on EN ∧ no stored preference. There is NO
    // automatic redirect — bots and users always get the URL they asked for.
    showSuggestion =
      navigator.language.toLowerCase().startsWith('vi') &&
      current === 'en' &&
      readLangPref() === null;
  }

  function choose(locale: Locale): void {
    writeLangPref(locale);
    showSuggestion = false;
  }

  function dismiss(): void {
    // Dismissing records a choice too, so the banner never returns.
    writeLangPref('en');
    showSuggestion = false;
  }

  onMount(() => {
    sync();
    document.addEventListener('astro:after-swap', sync);
    return () => document.removeEventListener('astro:after-swap', sync);
  });
</script>

<nav aria-label={label} class="font-mono text-[var(--text-badge)]" data-testid="sh-lang-switch">
  {#if current === 'vi'}
    <a href={pair.en} onclick={() => choose('en')} hreflang="en" data-testid="sh-lang-en">EN</a>
    <span aria-hidden="true"> | </span>
    <span aria-current="true">VI</span>
  {:else}
    <span aria-current="true">EN</span>
    <span aria-hidden="true"> | </span>
    <a href={pair.vi} onclick={() => choose('vi')} hreflang="vi" data-testid="sh-lang-vi">VI</a>
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
      href={pair.vi}
      onclick={() => choose('vi')}
      class="rounded-[var(--radius-pill)] border-2 px-3 py-2"
      style="background: var(--sh-accent); color: var(--sh-accent-ink); border-color: var(--sh-border)"
      >{suggestAccept}</a
    >
    <button
      type="button"
      onclick={dismiss}
      class="rounded-[var(--radius-pill)] border-2 px-3 py-2"
      style="border-color: var(--sh-border)">{suggestDismiss}</button
    >
  </div>
{/if}
