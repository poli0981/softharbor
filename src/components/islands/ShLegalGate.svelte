<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)
     docs/14 Part 2 — first-visit legal gate. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { acceptLegal, isAccepted } from '../../lib/legal';

  interface GateStrings {
    title: string;
    body: string;
    accept: string;
    disclaimer: string;
    terms: string;
    privacy: string;
    /** Joins the last two document links: "and" / "và". */
    and: string;
    /** Locale-prefixed base of the legal routes, e.g. `/legal` or `/vi/legal`. */
    base: string;
  }

  interface Props {
    /**
     * The page's own locale only. Before v1.1 the gate was `transition:persist`ed
     * across <ClientRouter /> swaps and had to carry BOTH locales to follow the
     * URL; with plain cross-document navigation every page mounts its own gate,
     * so it ships just the strings it renders.
     */
    strings: GateStrings;
  }
  const { strings }: Props = $props();

  let dialogEl: HTMLDialogElement | undefined = $state();

  /** Whether the gate must currently be shown. */
  const required = (): boolean => !isAccepted();

  function open(): void {
    if (dialogEl && !dialogEl.open) dialogEl.showModal();
    // Global shortcuts read this: `/` must not reach content behind an
    // un-accepted modal (docs/06 §9).
    document.body.dataset['shGate'] = 'open';
  }

  function onCancel(event: Event): void {
    // Esc must not dismiss the gate before acceptance (docs/14 Part 2).
    // `closedby="none"` is the primary guard; this covers browsers without it.
    if (required()) event.preventDefault();
  }

  function onClose(): void {
    // Chromium's close-watcher rules only honour preventDefault() on `cancel`
    // after a recent user activation, so a dialog opened from onMount can still
    // be closed by Esc. If it closed while acceptance is still outstanding,
    // put it straight back.
    if (required()) queueMicrotask(open);
    else document.body.dataset['shGate'] = 'closed';
  }

  function onAccept(): void {
    acceptLegal();
    dialogEl?.close();
  }

  onMount(() => {
    if (required()) open();
    else document.body.dataset['shGate'] = 'closed';
  });
</script>

<!-- No decline button by design: leaving the site is the alternative, and the
     copy says so (docs/14 Part 2). Exempt pages (legal documents, error and
     offline pages) never render this island at all — see Base.astro. -->
<dialog
  bind:this={dialogEl}
  closedby="none"
  oncancel={onCancel}
  onclose={onClose}
  aria-labelledby="sh-gate-title"
  aria-describedby="sh-gate-body"
  data-testid="sh-legal-gate"
  class="sh-gate"
>
  <!-- Focus lands on the heading, not on the first link or the accept button:
       a screen reader then reads the notice before any control. Autofocus is
       the dialog's own focusing step here, not a page-load focus grab. -->
  <h2 id="sh-gate-title" tabindex="-1" autofocus>{strings.title}</h2>
  <p id="sh-gate-body">
    {strings.body}
    <a href="{strings.base}/disclaimer">{strings.disclaimer}</a>,
    <a href="{strings.base}/terms">{strings.terms}</a>
    {strings.and}
    <a href="{strings.base}/privacy">{strings.privacy}</a>.
  </p>
  <button type="button" onclick={onAccept} data-testid="sh-legal-accept">
    {strings.accept}
  </button>
</dialog>

<style>
  .sh-gate {
    /* Tailwind's preflight zeroes margins globally, which kills the UA
       stylesheet's `margin: auto` that centres a modal <dialog>. */
    margin: auto;
    max-width: 32rem;
    border: 1px solid var(--sh-border);
    border-radius: var(--radius-card);
    background: var(--sh-surface);
    color: var(--sh-ink);
    padding: 1.5rem;
  }
  .sh-gate::backdrop {
    background: rgb(0 0 0 / 0.55);
  }
  h2 {
    font-family: var(--font-display);
    font-size: var(--text-h3);
    font-weight: 600;
    margin-bottom: 0.5rem;
    outline: none;
  }
  /* Preflight strips link colour and underline; in running text a link must
     not rely on colour alone (WCAG 1.4.1), so the underline comes back. */
  a {
    color: var(--sh-accent);
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }
  button {
    margin-top: 1rem;
    border: 1px solid var(--sh-border);
    border-radius: var(--radius-pill);
    background: var(--sh-accent);
    color: var(--sh-accent-ink);
    font-weight: 500;
    padding: 0.5rem 1.25rem;
    min-height: 44px;
  }

  /* Phones: a bottom sheet is reachable with one thumb and does not cover
     the content it is asking about. */
  @media (width < 40rem) {
    .sh-gate {
      margin: auto 0 0;
      width: 100%;
      max-width: none;
      border-radius: var(--radius-card) var(--radius-card) 0 0;
    }
  }
</style>
