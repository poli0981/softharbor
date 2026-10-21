<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)
     Display preferences (v1.1) — theme, scrollbar and motion in one menu.
     Replaces ShThemeToggle, so the island budget stays at six (docs/02 §5). -->
<script lang="ts">
  import { onMount } from 'svelte';
  import IconSliders from '~icons/lucide/sliders-horizontal';
  import {
    applyTheme,
    prefersDark,
    readChoice,
    resolve,
    writeChoice,
    type ThemeChoice,
  } from '../../lib/theme';
  import {
    applyMotion,
    applyScrollbar,
    readMotion,
    readScrollbar,
    writeMotion,
    writeScrollbar,
    type MotionChoice,
    type ScrollbarChoice,
  } from '../../lib/prefs';

  interface Props {
    /** Accessible name of the button and title of the panel. */
    label: string;
    themeLabel: string;
    themes: Record<ThemeChoice, string>;
    scrollbarLabel: string;
    scrollbars: Record<ScrollbarChoice, string>;
    motionLabel: string;
    motions: Record<MotionChoice, string>;
    /** Localized /apps#search — where `/` goes from pages without a search box. */
    searchHref: string;
  }
  const {
    label,
    themeLabel,
    themes,
    scrollbarLabel,
    scrollbars,
    motionLabel,
    motions,
    searchHref,
  }: Props = $props();

  // SSR renders the defaults; the real values are read on mount. The panel is
  // closed until then, so nothing visibly changes — and the button itself is
  // a fixed-size icon, unlike the old toggle whose label width changed on
  // hydration and shifted the header on every page load.
  let theme = $state<ThemeChoice>('system');
  let scrollbar = $state<ScrollbarChoice>('auto');
  let motion = $state<MotionChoice>('system');

  const root = (): HTMLElement => document.documentElement;

  function setTheme(next: ThemeChoice): void {
    theme = next;
    writeChoice(next);
    applyTheme(resolve(next), root());
  }

  function setScrollbar(next: ScrollbarChoice): void {
    scrollbar = next;
    writeScrollbar(next);
    applyScrollbar(next, root());
  }

  function setMotion(next: MotionChoice): void {
    motion = next;
    writeMotion(next);
    applyMotion(next, root());
  }

  /**
   * `/` jumps to search from any page (docs/06 §9). On /apps ShSearch owns the
   * key and focuses its box; everywhere else the header hint used to promise a
   * shortcut that did nothing.
   */
  function onGlobalKeydown(e: KeyboardEvent): void {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if (document.getElementById('sh-search')) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.body.dataset['shGate'] === 'open') return;
    e.preventDefault();
    location.assign(searchHref);
  }

  onMount(() => {
    theme = readChoice();
    scrollbar = readScrollbar();
    motion = readMotion();

    // While in system mode the OS can flip underneath us — follow it live
    // (docs/05 §A8). Once the visitor picks explicitly, stop following it.
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (theme === 'system') applyTheme(resolve('system', mq.matches), root());
    };
    // Another tab changed a preference: follow it here too.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'sh:theme') setTheme(readChoice());
      else if (e.key === 'sh:scrollbar') setScrollbar(readScrollbar());
      else if (e.key === 'sh:motion') setMotion(readMotion());
    };
    mq.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    document.addEventListener('keydown', onGlobalKeydown);
    return () => {
      mq.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('keydown', onGlobalKeydown);
    };
  });

  const themeChoices: ThemeChoice[] = ['system', 'light', 'dark'];
  const scrollbarChoices: ScrollbarChoice[] = ['auto', 'thin', 'hidden'];
  const motionChoices: MotionChoice[] = ['system', 'reduce'];

  /** For the button's tooltip: what "system" currently resolves to. */
  const resolvedTheme = $derived(
    theme === 'system' && typeof matchMedia === 'function'
      ? prefersDark()
        ? themes.dark
        : themes.light
      : themes[theme],
  );
</script>

<button
  type="button"
  class="sh-prefs-button"
  popovertarget="sh-prefs"
  aria-label={label}
  title={`${label} · ${themeLabel}: ${resolvedTheme}`}
  data-testid="sh-prefs-button"
>
  <IconSliders aria-hidden="true" width="1.25em" height="1.25em" />
</button>

<div
  id="sh-prefs"
  popover="auto"
  class="sh-prefs-panel"
  role="dialog"
  aria-labelledby="sh-prefs-title"
  data-testid="sh-prefs"
>
  <h2 id="sh-prefs-title" class="sh-prefs-title">{label}</h2>

  <fieldset>
    <legend>{themeLabel}</legend>
    <div class="sh-seg">
      {#each themeChoices as value (value)}
        <label>
          <input
            type="radio"
            name="sh-theme"
            {value}
            checked={theme === value}
            onchange={() => setTheme(value)}
          />
          <span>{themes[value]}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend>{scrollbarLabel}</legend>
    <div class="sh-seg">
      {#each scrollbarChoices as value (value)}
        <label>
          <input
            type="radio"
            name="sh-scrollbar"
            {value}
            checked={scrollbar === value}
            onchange={() => setScrollbar(value)}
          />
          <span>{scrollbars[value]}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend>{motionLabel}</legend>
    <div class="sh-seg">
      {#each motionChoices as value (value)}
        <label>
          <input
            type="radio"
            name="sh-motion"
            {value}
            checked={motion === value}
            onchange={() => setMotion(value)}
          />
          <span>{motions[value]}</span>
        </label>
      {/each}
    </div>
  </fieldset>
</div>

<style>
  .sh-prefs-button {
    display: inline-grid;
    place-items: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border: 1px solid var(--sh-control);
    border-radius: var(--radius-btn);
    background: var(--sh-surface);
    color: var(--sh-ink);
    transition: border-color var(--duration-fast) var(--ease-sh);
  }
  .sh-prefs-button:hover {
    border-color: var(--sh-accent);
    background: var(--sh-surface-2);
  }

  /* A popover is in the top layer and starts as a centred box with margin
     auto; pin it under the header's right edge instead. */
  .sh-prefs-panel {
    position: fixed;
    inset: 4.25rem 1rem auto auto;
    margin: 0;
    inline-size: min(22rem, calc(100vw - 2rem));
    padding: 1.25rem;
    border: 1px solid var(--sh-border);
    border-radius: var(--radius-card);
    background: var(--sh-surface);
    color: var(--sh-ink);
    box-shadow: var(--sh-shadow-3);
  }
  .sh-prefs-title {
    font-family: var(--font-display);
    font-size: var(--text-h3);
    font-weight: 600;
  }
  fieldset {
    margin-block-start: 1rem;
  }
  legend {
    font-size: var(--text-small);
    color: var(--sh-muted);
    margin-block-end: 0.375rem;
  }

  /* Segmented control built from real radio buttons: native keyboard
     behaviour (arrow keys), one tab stop per group, form semantics for free. */
  .sh-seg {
    display: flex;
    border: 1px solid var(--sh-control);
    border-radius: var(--radius-btn);
    overflow: hidden;
  }
  .sh-seg label {
    flex: 1;
    position: relative;
  }
  .sh-seg input {
    position: absolute;
    inset: 0;
    opacity: 0;
    margin: 0;
    cursor: pointer;
  }
  .sh-seg span {
    display: grid;
    place-items: center;
    min-block-size: 2.5rem;
    padding: 0 0.5rem;
    font-size: var(--text-small);
    text-align: center;
  }
  .sh-seg label + label span {
    border-inline-start: 1px solid var(--sh-border);
  }
  .sh-seg input:checked + span {
    background: var(--sh-accent);
    color: var(--sh-accent-ink);
    font-weight: 600;
  }
  .sh-seg input:focus-visible + span {
    outline: 2px solid var(--sh-accent);
    outline-offset: -4px;
  }

  @media (width < 40rem) {
    .sh-prefs-panel {
      inset: auto 0 0 0;
      inline-size: 100%;
      border-radius: var(--radius-card) var(--radius-card) 0 0;
    }
  }
</style>
