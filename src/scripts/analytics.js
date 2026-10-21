/* SPDX-License-Identifier: GPL-3.0-only
   Copyright (C) 2026 poli0981 (SkullMute)

   Cloudflare Web Analytics, loaded only for visitors who have not asked not
   to be tracked (docs/09 §8, D26).

   - Global Privacy Control on → nothing loads and nothing is sent.
   - Any host but softharbor.net (PR previews, localhost, the e2e suite) →
     nothing loads: those visits are not SoftHarbor's traffic.

   The beacon sets no cookies and stores nothing in the browser. It reports
   the page URL, the referrer, page-load timings and the browser's user agent
   to Cloudflare, which aggregates them; we see totals, never a visitor. The
   element built here is Cloudflare's own manual snippet — a module script
   carrying `data-cf-beacon` — created by code instead of written into the
   page only so the GPC check can run first.

   Loaded `defer` from Base.astro via `?url&no-inline`, like theme.js. */
(() => {
  if (navigator.globalPrivacyControl === true) return;
  if (location.hostname !== 'softharbor.net') return;
  const beacon = document.createElement('script');
  beacon.type = 'module';
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.dataset.cfBeacon = JSON.stringify({ token: '3901bbd0eb53453aa51bc10390e07fd3' });
  document.head.append(beacon);
})();
