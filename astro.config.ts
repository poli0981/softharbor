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
  // Must agree with assets.html_handling in wrangler.jsonc — docs/02 §7, spike S1.
  trailingSlash: 'never',

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
      manifest: {
        name: 'SoftHarbor',
        short_name: 'SoftHarbor',
        description: 'Free & buy-once desktop software, one page.',
        theme_color: '#f7f4ee',
        background_color: '#f7f4ee',
        icons: [],
      },
      workbox: {
        // Fonts are content-hashed into _astro/, not a /fonts/ directory — an
        // earlier spec's 'fonts/*.woff2' glob matched nothing, which would
        // have shipped an unstyled offline page (found in M1).
        globPatterns: ['offline/**', '_astro/*.woff2', 'favicon.svg'],
        navigateFallback: '/offline',
        navigateFallbackDenylist: [/^\/api\//, /^\/rss\.xml$/],
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss(), Icons({ compiler: 'astro' })],
  },

  // No CSP config: nothing inline ships, so `script-src 'self'` in
  // public/_headers is the whole story — docs/09 §4, decision D18.
});
