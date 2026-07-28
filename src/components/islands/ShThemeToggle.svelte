<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)
     docs/05 §A8, docs/06 §4 — cycles system → light → dark. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    applyTheme,
    nextChoice,
    prefersDark,
    readChoice,
    resolve,
    writeChoice,
    type ThemeChoice,
  } from '../../lib/theme';

  interface Props {
    labels: Record<ThemeChoice, string>;
    /** Accessible name for the control itself, e.g. "Theme". */
    label: string;
  }
  const { labels, label }: Props = $props();

  let choice = $state<ThemeChoice>('system');

  function set(next: ThemeChoice): void {
    choice = next;
    writeChoice(next);
    applyTheme(resolve(next), document.documentElement);
  }

  onMount(() => {
    choice = readChoice();
    // theme.js already applied the right value pre-paint; re-applying here
    // keeps the two in agreement if storage changed in another tab.
    applyTheme(resolve(choice), document.documentElement);

    // While in system mode the OS can flip underneath us — follow it live
    // (docs/05 §A8). Once the user picks explicitly, stop listening to it.
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (choice === 'system') applyTheme(resolve('system', mq.matches), document.documentElement);
    };
    mq.addEventListener('change', onSystemChange);
    return () => mq.removeEventListener('change', onSystemChange);
  });

  // The button announces what is ACTIVE, not what clicking will do — a toggle
  // labelled with its next state is a well-known screen-reader trap.
  const current = $derived(labels[choice]);
  const resolved = $derived(choice === 'system' ? (prefersDarkSafe() ? 'dark' : 'light') : choice);

  function prefersDarkSafe(): boolean {
    return typeof matchMedia === 'function' ? prefersDark() : false;
  }
</script>

<button
  type="button"
  class="sh-pill border-sh-muted text-sh-muted min-h-11 px-3"
  aria-label={`${label}: ${current}`}
  data-testid="sh-theme-toggle"
  data-choice={choice}
  onclick={() => set(nextChoice(choice))}
>
  <span aria-hidden="true">{resolved === 'dark' ? '◑' : '◐'}</span>
  <span>{current}</span>
</button>
