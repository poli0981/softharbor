/* SPDX-License-Identifier: GPL-3.0-only
   Copyright (C) 2026 poli0981 (SkullMute)

   No-flash theme resolution — docs/05 §A8.

   Loaded as a BLOCKING classic <script src> in <head> (no defer, no async, no
   type=module) so it runs before first paint. Base.astro references it via
   `?url&no-inline`: Vite copies it verbatim to a content-hashed /_astro/ file
   that is cached immutably. `no-inline` matters — plain `?url` inlines any
   file under 4 KiB as a data: URL, which `script-src 'self'` refuses.

   Storage access is guarded. With site data blocked, localStorage THROWS, and
   an unguarded read used to abort here, leaving dark-OS visitors on the light
   theme. The rules match src/lib/theme.ts: only 'light' / 'dark' are explicit
   choices; anything else (missing, garbage) means "follow the system". */
(() => {
  let stored = null;
  try {
    stored = localStorage.getItem('sh:theme');
  } catch {
    /* storage unavailable — follow the system preference */
  }
  const explicit = stored === 'light' || stored === 'dark' ? stored : null;
  const dark = explicit ? explicit === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
