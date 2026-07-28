// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';

// Reachable but meaningless in SERPs — noindex'd (docs/16 §7) AND kept out of
// the sitemap, or GSC reports "Submitted URL marked noindex" forever.
const NON_INDEXED = /\/(404|500|403|429|offline)\/?$/;

// https://astro.build/config
export default defineConfig({
  site: 'https://softharbor.net',
  output: 'static',

  // trailingSlash + build.format + wrangler's html_handling are ONE decision,
  // not three (spike S1, measured 2026-07-27 on a real deploy).
  //
  // With the default `format: 'directory'` Astro emits dist/apps/index.html,
  // and Workers' auto-trailing-slash then 307s /apps -> /apps/. But our
  // canonicals, sitemap, hreflang alternates and internal links all use the
  // NO-slash form, so every advertised URL would cost a redirect and none of
  // them would ever return 200 directly — the duplicate-content hazard
  // docs/16 works hard to avoid, plus a round-trip on every navigation.
  //
  // `format: 'file'` emits dist/apps.html, so /apps IS the asset. Paired with
  // html_handling: "drop-trailing-slash" in wrangler.jsonc, /apps/ redirects
  // to /apps and the canonical URL is the one that serves.
  trailingSlash: 'never',
  build: { format: 'file' },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'vi'],
    routing: { prefixDefaultLocale: false },
  },

  // Astro emits a per-page <meta http-equiv="content-security-policy"> whose
  // script-src/style-src carry hashes for the inline snippets IT generates
  // (island hydration bootstraps). We cannot enumerate those by hand, and a
  // static _headers file cannot learn them — so the meta tag owns script-src
  // and style-src, and _headers owns only frame-ancestors (which meta-tag CSP
  // ignores by spec). See docs/09 §4. Both policies are enforced, so _headers
  // must NOT also constrain scripts or styles or the intersection wins.
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "object-src 'none'",
      ],
    },
  },

  integrations: [
    svelte(),
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', vi: 'vi' } },
      filter: (page) => !NON_INDEXED.test(page),
    }),
    AstroPWA({
      registerType: 'autoUpdate',
      // MUST be explicit. Without it the build still emits registerSW.js but
      // never references it from any page, so the service worker never
      // registers and the offline fallback silently does not exist — the
      // build reports success either way (found in spike S5, 2026-07-27).
      // 'script' (external file) not 'inline': the CSP is script-src 'self'
      // plus hashes Astro generates, and a PWA-injected inline snippet is not
      // one of them (docs/09 §4, D20).
      injectRegister: 'script',
      manifest: {
        name: 'SoftHarbor',
        short_name: 'SoftHarbor',
        description: 'Free & buy-once desktop software, one page.',
        theme_color: '#f7f4ee',
        background_color: '#f7f4ee',
        icons: [],
      },
      workbox: {
        // These globs are coupled to build.format — 'file' emits offline.html,
        // 'directory' would emit offline/index.html. And fonts are
        // content-hashed into _astro/, never a /fonts/ directory. Both of the
        // original patterns ('offline/**', 'fonts/*.woff2') matched nothing,
        // which is a silent failure: the build succeeds and the offline page
        // simply is not there (found in M1 and S5).
        // (favicon.svg lands in M5 — adding it here before it exists only
        // produces a build warning.)
        globPatterns: ['offline.html', '_astro/*.woff2'],

        // skipWaiting is already true under registerType 'autoUpdate', but
        // clientsClaim is not — without it the SW controls only pages loaded
        // AFTER activation, so a first-time visitor who loses connection mid
        // session gets the browser's error page instead of ours (S5).
        clientsClaim: true,

        // NO `navigateFallback` here. On its own it registers a NavigationRoute
        // that serves the precached fallback for EVERY navigation — verified in
        // S5: an online request for /apps returned the offline page. Content
        // freshness beats offline cleverness (docs/08 Part D), so navigations
        // are NetworkOnly and the offline page is strictly a failure path.
        //
        // The glob matches the FILE (offline.html); Workbox normalises the
        // precache key to the extensionless '/offline', which is what
        // fallbackURL must name. Confirmed against the emitted manifest.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkOnly',
            options: { precacheFallback: { fallbackURL: '/offline' } },
          },
        ],
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss(), Icons({ compiler: 'astro' })],
  },

  // No CSP config: nothing inline ships, so `script-src 'self'` in
  // public/_headers is the whole story — docs/09 §4, decision D18.
});
