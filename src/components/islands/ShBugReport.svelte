<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)
     docs/05 §A5/§A6, docs/06 §4 — footer "Report a bug".

     The sixth and final island (docs/02 §5). A seventh needs a decision-log
     entry. -->
<script lang="ts">
  import { buildBugUrl } from '../../lib/issueUrl';
  import { bufferSize, getBuffer } from '../../lib/ringbuffer';

  interface Props {
    label: string;
    /** Shown next to the button when the buffer has caught something. */
    countLabel: string;
  }
  const { label, countLabel }: Props = $props();

  let href = $state('#');
  let count = $state(0);

  /**
   * Built on hover/focus rather than up front: the URL embeds the CURRENT page
   * and the CURRENT buffer, both of which change as the user moves around, and
   * this island persists nothing.
   */
  function refresh(): void {
    count = bufferSize();
    href = buildBugUrl(getBuffer(), {
      href: location.href,
      userAgent: navigator.userAgent,
      lang: document.documentElement.lang,
    });
  }
</script>

<!-- A real link, not a button calling window.open: the user can see the target,
     middle-click it, or copy it. Nothing is transmitted until they submit the
     form on GitHub themselves (docs/09 §8, docs/14 §3b). -->
<a
  {href}
  rel="noopener"
  target="_blank"
  data-testid="sh-bug-report"
  onmouseenter={refresh}
  onfocus={refresh}
  onclick={refresh}
  class="hover:underline"
>
  {label}{#if count > 0}<span class="ml-1 font-mono text-[var(--text-badge)]"
      >({countLabel.replaceAll('{n}', String(count))})</span
    >{/if}
</a>
