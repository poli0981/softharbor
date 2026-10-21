// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { createHash } from 'node:crypto';
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';
import { VIEW_TRANSITION_OPT_IN } from './src/lib/inlineCss';

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
  // `inlineStylesheets: 'never'` began as a CSP fix and stays as a cache one.
  //
  // Under the former `<ClientRouter />`, a soft navigation never re-applied
  // the meta CSP, so a small stylesheet Astro had inlined (and hashed into ONE
  // page's policy) was refused on arrival from any page that lacked it — which
  // silently dropped ShAppCard's stretched link and `.sr-only` on /apps.
  // ClientRouter is gone since v1.1 (every navigation is a real document load
  // with its own policy), but external stylesheets are still the better
  // shape: covered by `style-src 'self'` with no hash at all, and cached once
  // across ~700 pages instead of shipping inside each one.
  build: { format: 'file', inlineStylesheets: 'never' },

  // OFF because the platform refuses it, not because it is unwanted. A
  // speculative GET carrying `Sec-Purpose: prefetch` is answered by Cloudflare
  // with a bare **503** and `Cf-Speculation-Refused: prefetch refused:
  // disabled for worker requests` — reproducible on demand, and nothing to do
  // with rate limiting:
  //
  //   curl -I -H 'Sec-Purpose: prefetch' https://softharbor.net/apps   → 503
  //   curl -I                            https://softharbor.net/apps   → 200
  //
  // So prefetching would cost a failed request and a red console line per
  // hover while delivering nothing. (The zone's Speed Brain feature hits the
  // same refusal and should be off — docs/16 §9.) Revisit if Cloudflare ever
  // allows speculation on Worker routes.
  prefetch: false,

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
      // The one `is:inline` <style> (src/lib/inlineCss.ts) — Astro hashes
      // only what it bundles, so this hash is ours to supply.
      styleDirective: {
        hashes: [
          `sha256-${createHash('sha256').update(VIEW_TRANSITION_OPT_IN).digest('base64')}` as const,
        ],
      },
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
        id: '/',
        name: 'SoftHarbor',
        short_name: 'SoftHarbor',
        description: 'Free & buy-once desktop software, one page.',
        lang: 'en',
        // The tile colour of the mark (scripts/gen-icons.mjs), so the install
        // splash and title bar match the icon rather than the page.
        theme_color: '#0B4F7A',
        background_color: '#0B4F7A',
        // Raster icons generated from one vector mark (`pnpm icons`). Until
        // v1.1 the only icon was the SVG favicon drawn in currentColor —
        // black in launchers — declared 'any maskable' with no safe zone.
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // These globs are coupled to build.format — 'file' emits offline.html,
        // 'directory' would emit offline/index.html. And fonts are
        // content-hashed into _astro/, never a /fonts/ directory. Both of the
        // original patterns ('offline/**', 'fonts/*.woff2') matched nothing,
        // which is a silent failure: the build succeeds and the offline page
        // simply is not there (found in M1 and S5).
        //
        // What the offline page actually needs, and nothing more:
        //  - its stylesheets. Missing until v1.1 — once inlineStylesheets went
        //    'never', /offline linked CSS the SW never cached, so it rendered
        //    unstyled exactly when it was needed;
        //  - the two pre-paint scripts it loads (errors.js, theme.js);
        //  - the latin + Vietnamese body and display faces. Precaching all 13
        //    font files (211 KB, latin-ext and mono included) on a visitor's
        //    first page view was a lot of bandwidth for a fallback page; the
        //    rest falls back to system fonts.
        globPatterns: [
          'offline.html',
          '_astro/*.css',
          '_astro/{errors,theme}.*.js',
          '_astro/be-vietnam-pro-{latin,vietnamese}-400-normal.*.woff2',
          '_astro/bricolage-grotesque-{latin,vietnamese}-wght-normal.*.woff2',
          'favicon.svg',
        ],

        // A new SW takes over as soon as it is installed. registerSW.js never
        // posts SKIP_WAITING, so without this a fixed SW waited until every
        // SoftHarbor tab was closed (an older comment here wrongly claimed
        // 'autoUpdate' implied it).
        skipWaiting: true,
        // Without clientsClaim the SW controls only pages loaded AFTER
        // activation, so a first-time visitor who loses connection mid
        // session gets the browser's error page instead of ours (S5).
        clientsClaim: true,

        // `navigateFallback: ''` DISABLES it. Leaving the key out does not:
        // vite-plugin-pwa's `defaultWorkbox` sets `navigateFallback:
        // 'index.html'`, so omitting it still emitted
        // `registerRoute(new NavigationRoute(createHandlerBoundToURL('/')))`.
        // Since `index.html` is not in `globPatterns`, every navigation the SW
        // handled threw `non-precached-url :: [{"url":"/"}]` — which is what a
        // visitor saw on returning from an external link.
        //
        // The throw was doing us a favour. Had `/` been precached, that route
        // would have served the HOME PAGE for every navigation — the same
        // class of bug S5 caught when an online request for /apps returned the
        // offline page. Content freshness beats offline cleverness (docs/08
        // Part D), so navigations are NetworkOnly and the offline page is
        // strictly a failure path. Empty string, not `undefined`, because
        // `exactOptionalPropertyTypes` rejects an explicit undefined and the
        // plugin only tests the value for truthiness.
        //
        // The glob matches the FILE (offline.html); Workbox normalises the
        // precache key to the extensionless '/offline', which is what
        // fallbackURL must name. Confirmed against the emitted manifest.
        navigateFallback: '',
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
    // `~icons/<set>/<name>` imports compile to Svelte 5 components: usable in
    // islands, and in .astro files (rendered to static SVG at build time).
    // Data-driven icons (app logos, category icons) go through src/lib/icon.ts.
    plugins: [tailwindcss(), Icons({ compiler: 'svelte' })],
  },
});
