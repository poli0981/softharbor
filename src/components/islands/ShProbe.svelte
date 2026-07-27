<!-- SPDX-License-Identifier: GPL-3.0-only
     Copyright (C) 2026 poli0981 (SkullMute)

     S1 probe island. Exists to prove the runtime combination works:
     Svelte 5 runes + nanostores consumed via Svelte's native store contract
     (no @nanostores/svelte package — it does not exist; nanostores atoms
     already expose a conforming .subscribe, see docs/01 §2) + Tailwind
     classes surviving the build. Deleted or replaced in M3. -->
<script lang="ts">
  import { atom } from 'nanostores';

  const query = atom('');
  let hits = $state(0);

  // Svelte's $store auto-subscription works directly on a nanostores atom.
  $effect(() => {
    const stop = query.subscribe((v) => {
      hits = v.length;
    });
    return stop;
  });
</script>

<div class="rounded-[10px] border-2 p-4" style="border-color: var(--sh-border)">
  <label class="font-mono text-xs" for="probe">probe</label>
  <input
    id="probe"
    class="w-full bg-transparent"
    oninput={(e) => query.set(e.currentTarget.value)}
    placeholder="type…"
  />
  <p class="font-mono text-xs" style="color: var(--sh-muted)">chars: {hits}</p>
</div>
