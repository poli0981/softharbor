<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)
     docs/14 Part 2 — first-visit legal gate. Spike S4. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { acceptLegal, isAccepted, isExempt } from '../../lib/legal';

  interface Props {
    /** Locale of the page that first rendered the island (SSR correctness). */
    locale?: 'en' | 'vi';
  }
  const { locale: initialLocale = 'en' }: Props = $props();

  let dialogEl: HTMLDialogElement | undefined = $state();
  let shouldShow = $state(false);

  /**
   * Locale is tracked from the URL, not just the prop.
   *
   * `transition:persist` keeps this island across navigations — including
   * /apps → /vi/apps. The prop is only ever the value from the page that
   * FIRST rendered it, so a persisted gate would keep showing English copy on
   * a Vietnamese page. Re-deriving on every swap is what makes the gate
   * bilingual in practice (found in spike S4).
   */
  // svelte-ignore state_referenced_locally
  // Capturing only the initial value is the intent: this is a seed for the
  // first paint, and evaluate() re-derives it from the URL on every swap.
  let locale = $state<'en' | 'vi'>(initialLocale);

  function localeFromPath(pathname: string): 'en' | 'vi' {
    return pathname === '/vi' || pathname.startsWith('/vi/') ? 'vi' : 'en';
  }

  /**
   * Re-assert the dialog's state against the CURRENT route.
   *
   * This runs on mount and after every ClientRouter swap. Both halves matter:
   * the route changes under a persisted island (so an exempt page must close
   * the gate), and a <dialog> that was in the top layer can come out of a
   * document swap with `open` cleared — re-calling showModal() is what makes
   * `transition:persist` actually persist the *modal* state, not just the DOM.
   */
  function evaluate(): void {
    locale = localeFromPath(location.pathname);
    shouldShow = !isExempt(location.pathname) && !isAccepted();
    if (!dialogEl) return;
    if (shouldShow) {
      if (!dialogEl.open) dialogEl.showModal();
    } else if (dialogEl.open) {
      dialogEl.close();
    }
    // Hook for global shortcuts: `/` must not reach the search box while the
    // gate is up (docs/06 §9). Exposed on <body> so non-island code can read it.
    document.body.dataset.shGate = shouldShow ? 'open' : 'closed';
  }

  function onCancel(event: Event): void {
    // Esc must not dismiss the gate before acceptance (docs/14 Part 2).
    if (shouldShow) event.preventDefault();
  }

  function onAccept(): void {
    acceptLegal();
    evaluate();
  }

  onMount(() => {
    evaluate();
    document.addEventListener('astro:after-swap', evaluate);
    document.addEventListener('astro:page-load', evaluate);
    return () => {
      document.removeEventListener('astro:after-swap', evaluate);
      document.removeEventListener('astro:page-load', evaluate);
    };
  });

  // Copy is placeholder text for S4. The shipped strings come from the i18n
  // dictionaries in M4 (docs/07 §3) — this island must not become a second
  // home for user-facing copy.
  const COPY = {
    en: {
      title: 'Before you continue',
      body: 'SoftHarbor is a link directory. We don’t host downloads, and we can’t guarantee third-party software. Statuses like “no known warnings” reflect checks on the date shown — verify anything you install. By continuing you accept the',
      disclaimer: 'Disclaimer',
      terms: 'Terms of Use',
      privacy: 'Privacy Policy',
      accept: 'I understand and accept',
      base: '/legal',
    },
    vi: {
      title: 'Trước khi tiếp tục',
      body: 'SoftHarbor là trang tổng hợp liên kết. Chúng tôi không lưu trữ tệp cài đặt và không thể bảo đảm cho phần mềm bên thứ ba. Trạng thái như “không có cảnh báo đã biết” chỉ phản ánh việc kiểm tra tại ngày ghi kèm — hãy tự xác minh trước khi cài đặt. Khi tiếp tục, bạn chấp nhận',
      disclaimer: 'Tuyên bố miễn trừ',
      terms: 'Điều khoản sử dụng',
      privacy: 'Chính sách quyền riêng tư',
      accept: 'Tôi hiểu và chấp nhận',
      base: '/vi/legal',
    },
  } as const;

  const copy = $derived(COPY[locale]);
</script>

<!-- No decline button by design: leaving the site is the alternative, and the
     copy says so (docs/14 Part 2). -->
<dialog
  bind:this={dialogEl}
  oncancel={onCancel}
  aria-labelledby="sh-gate-title"
  data-testid="sh-legal-gate"
>
  <h2 id="sh-gate-title">{copy.title}</h2>
  <p>
    {copy.body}
    <a href="{copy.base}/disclaimer">{copy.disclaimer}</a>,
    <a href="{copy.base}/terms">{copy.terms}</a>,
    <a href="{copy.base}/privacy">{copy.privacy}</a>.
  </p>
  <button type="button" onclick={onAccept} data-testid="sh-legal-accept">
    {copy.accept}
  </button>
</dialog>

<style>
  dialog {
    /* Tailwind's preflight zeroes margins globally, which kills the UA
       stylesheet's `margin: auto` that centres a modal <dialog>. Without this
       the gate renders in the top-left corner. */
    margin: auto;
    max-width: 32rem;
    border: 2px solid var(--sh-border);
    border-radius: 10px;
    background: var(--sh-surface);
    color: var(--sh-ink);
    padding: 1.5rem;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
  }
  button {
    margin-top: 1rem;
    border: 2px solid var(--sh-border);
    border-radius: 999px;
    background: var(--sh-accent);
    color: var(--sh-accent-ink, #fff);
    padding: 0.5rem 1rem;
    min-height: 44px;
  }
</style>
