/* SPDX-License-Identifier: GPL-3.0-only
   Copyright (C) 2026 poli0981 (SkullMute)

   No-flash theme resolution — docs/05 §A8.
   Loaded as a BLOCKING <script src> in <head> (no defer, no async) so it runs
   before first paint. It lives in public/ and is deliberately NOT bundled: it
   must run before any module, and an external same-origin file is covered by
   the page CSP's `script-src 'self'` without a hash (docs/09 §4).

   Storage access is guarded. With site data blocked, localStorage THROWS, and
   this script runs before errors.js exists — an unguarded read used to abort
   here, leaving dark-OS visitors on the light theme with nothing logged. The
   rules match src/lib/theme.ts: only 'light' / 'dark' are explicit choices;
   anything else (missing, garbage) means "follow the system". */
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
