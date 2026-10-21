/* SPDX-License-Identifier: GPL-3.0-only
   Copyright (C) 2026 poli0981 (SkullMute)

   No-flash display preferences — docs/05 §A8.

   Loaded as a BLOCKING classic <script src> in <head> (no defer, no async, no
   type=module) so it runs before first paint. Base.astro references it via
   `?url&no-inline`: Vite copies it verbatim to a content-hashed /_astro/ file
   that is cached immutably. `no-inline` matters — plain `?url` inlines any
   file under 4 KiB as a data: URL, which `script-src 'self'` refuses.

   Applies all three preferences the ShPrefs menu sets, as attributes on
   <html> that the CSS keys off:
     data-theme      light | dark            (sh:theme, else the OS setting)
     data-scrollbar  thin | hidden | absent  (sh:scrollbar)
     data-motion     reduce | absent         (sh:motion)

   Storage access is guarded. With site data blocked, localStorage THROWS, and
   an unguarded read used to abort here, leaving dark-OS visitors on the light
   theme. The rules match src/lib/theme.ts and src/lib/prefs.ts exactly (pinned
   by prefs.test.ts): unknown or garbage values mean "the default". */
(() => {
  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const root = document.documentElement;

  const theme = read('sh:theme');
  const explicit = theme === 'light' || theme === 'dark' ? theme : null;
  const dark = explicit ? explicit === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'dark' : 'light';

  const scrollbar = read('sh:scrollbar');
  if (scrollbar === 'thin' || scrollbar === 'hidden') root.dataset.scrollbar = scrollbar;

  if (read('sh:motion') === 'reduce') root.dataset.motion = 'reduce';

  // Cross-document View Transitions (global.css `@view-transition`). When the
  // browser aborts one — a page that is slow to reveal, an opt-in mismatch —
  // it rejects the transition's promises, and with nobody holding them that
  // surfaces as an unhandled rejection ("Transition was aborted because of
  // invalid state"). Nothing is wrong for the visitor; the navigation simply
  // happens without the fade. Marking the promises handled keeps that noise
  // out of the console and out of bug reports (errors.js records unhandled
  // rejections). Registered here because pagereveal fires before any
  // deferred or module script runs.
  const settle = (e) => {
    const vt = e.viewTransition;
    if (!vt) return;
    for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch(() => {});
  };
  addEventListener('pageswap', settle);
  addEventListener('pagereveal', settle);
})();
