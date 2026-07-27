/* SPDX-License-Identifier: GPL-3.0-only
   Copyright (C) 2026 poli0981 (SkullMute)

   No-flash theme resolution — docs/05 §A8.
   Loaded as a BLOCKING <script src> in <head> (no defer, no async) so it runs
   before first paint. It lives in public/ and is deliberately NOT bundled:
   the strict CSP is `script-src 'self'` with no hashes (docs/09 §4, D18), so
   nothing inline may ship, and the path must stay stable. */
(() => {
  const s = localStorage.getItem('sh:theme'); // 'light' | 'dark' | null
  const dark = s ? s === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
