# 02 — Architecture

## 1. Shape of the system

Fully static. The repository *is* the database; a deploy *is* a data
migration.

```
 maintainer PR ──▶ GitHub main ──▶ CI (astro build + checks)
                                        │  dist/
                                        ▼
                      wrangler deploy → Cloudflare Workers Static Assets
                                        │  (no Worker script, requests unbilled)
                                        ▼
                                     Browser
                     static HTML/CSS  +  6 Svelte islands (client JS)
                     search index & app JSON fetched from same origin
```

Consequences (accepted, documented):

- No server-side anything: no SSR, no API routes at runtime, no rate
  limiting of our own, no server logs beyond Cloudflare's dashboard metrics.
- "Dynamic" behaviors are relocated: data mutation → Git + GitHub Actions;
  personalization → localStorage; search → client-side index.
- 403/429 cannot originate from us in v1 — the zone's security features
  (rate limiting, Bot Fight Mode) are deliberately OFF (docs/16 §9);
  templates exist but are dormant (docs/08 §C).

## 2. Project tree

```
softharbor/
├── CLAUDE.md                      # AI dev instructions
├── LICENSE                        # GPL-3.0-only (GitHub picker)
├── LICENSE-DATA.md                # CC BY-SA 4.0 for src/data/** (docs/14 §1)
├── README.md                      # bilingual EN/VI (written in P6)
├── astro.config.ts
├── wrangler.jsonc
├── package.json / pnpm-lock.yaml / .nvmrc
├── eslint.config.js / prettier.config.js / knip.json / lefthook.yml
├── data/
│   └── quarantine/                # flagged apps parked here (docs/03 §5)
├── scripts/
│   ├── validate-data.mjs          # cross-file checks beyond Zod (docs/03 §2)
│   ├── quarantine.mjs             # move flagged entries (docs/12 §4)
│   └── extract-urls.mjs           # URL list for lychee (docs/12 §5)
├── public/
│   ├── _headers                   # security headers (docs/09 §4)
│   ├── robots.txt
│   ├── .well-known/security.txt
│   ├── favicon.svg / icons/       # PWA icons
│   └── logos/                     # (empty; local logos live in src/assets)
└── src/
    ├── content.config.ts          # Zod collections: apps, categories
    ├── data/
    │   ├── apps/*.json            # ONE file per app, filename = slug
    │   └── categories.json        # category registry (docs/04 §4)
    ├── assets/logos/*.svg|webp    # self-hosted logos when Simple Icons lacks one
    ├── i18n/
    │   ├── en.json / vi.json      # UI dictionaries
    │   └── index.ts               # typed t() helper (docs/07 §3)
    ├── lib/
    │   ├── normalize.ts           # VN-insensitive normalizer (docs/05 §A1)
    │   ├── search.ts              # MiniSearch factory (docs/05 §A2)
    │   ├── stores.ts              # nanostores: query/filters/sort
    │   ├── ringbuffer.ts          # console error buffer (docs/05 §A5)
    │   └── issueUrl.ts            # bug-report URL builder (docs/05 §A6)
    ├── components/
    │   ├── Sh*.astro              # static components (cards, badges, header…)
    │   └── islands/Sh*.svelte     # the 6 islands (§5)
    ├── layouts/Base.astro
    ├── styles/global.css          # @theme tokens (docs/06 §2)
    └── pages/
        ├── index.astro                       # Welcome
        ├── apps/index.astro                  # grid + search island
        ├── apps/[slug].astro                 # detail (getStaticPaths)
        ├── categories/[id].astro
        ├── legal/{disclaimer,privacy,terms,trademarks,third-party}.astro
        ├── errors/{403,429,500}.astro        # dormant templates
        ├── 404.astro                         # → dist/404.html
        ├── offline.astro                     # SW fallback
        ├── api/apps.json.ts                  # static JSON export
        ├── search-index.json.ts              # prebuilt MiniSearch index
        ├── rss.xml.ts
        └── vi/…                              # mirrored VI routes (docs/07 §2)
```

## 3. Routing table

| Route (EN) | VI mirror | Rendered from | Notes |
|---|---|---|---|
| `/` | `/vi/` | `index.astro` | Welcome: hero, category tiles, latest additions |
| `/apps` | `/vi/apps` | `apps/index.astro` | Grid; search/filter island |
| `/apps/[slug]` | `/vi/apps/[slug]` | `[slug].astro` | One page per app; `getStaticPaths` over the collection |
| `/categories/[id]` | `/vi/categories/[id]` | `[id].astro` | SEO landing per category |
| `/legal/*` | `/vi/legal/*` | static pages | Exempt from legal gate (docs/14 §2) |
| `/404` | — | `404.astro` | Served via `not_found_handling` |
| `/offline` | — | `offline.astro` | SW navigation fallback |
| `/errors/{403,429,500}` | — | templates | Dormant until custom domain |
| `/api/apps.json` | — | endpoint | Full dataset export (docs/03 §6) |
| `/search-index.json` | — | endpoint | Serialized MiniSearch index, lazy-loaded |
| `/rss.xml` | — | endpoint | Latest additions feed |

## 4. Astro configuration (reference)

```ts
// astro.config.ts
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
  site: 'https://softharbor.net',
  output: 'static',
  trailingSlash: 'never',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'vi'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    svelte(),
    sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', vi: 'vi' } } }),
    AstroPWA(/* docs/08 §D */),
  ],
  vite: {
    plugins: [tailwindcss(), Icons({ compiler: 'astro' })],
  },
  // CSP hashing for the few inline scripts — docs/09 §4
});
```

## 5. Islands & hydration budget

| Island | Directive | Why |
|---|---|---|
| `ShLegalGate.svelte` | `client:load` + `transition:persist` | Must block interaction immediately; survives View Transitions |
| `ShSearch.svelte` | `client:idle` | Grid is readable without it; index fetched on first focus |
| `ShFilterSheet.svelte` | `client:idle` | Shares nanostores with search |
| `ShLangSwitch.svelte` | `client:idle` | Persists `sh:lang`, rewrites path |
| `ShThemeToggle.svelte` | `client:idle` | Persists `sh:theme`; no-flash script is inline+hashed |
| `ShBugReport.svelte` | `client:visible` (footer) | Reads ring buffer, opens prefilled issue URL |

Everything else is `.astro` with zero client JS. Adding a seventh island
requires a decision-log entry.

## 6. View Transitions

Astro `<ClientRouter />` enabled site-wide. Card → detail uses
`transition:name={slug}` on the logo+title block for a morph effect;
`prefers-reduced-motion` disables all transitions (docs/06 §7). The legal
gate island persists across navigations so acceptance state never re-flashes
(verified by spike S4).

## 7. wrangler.jsonc (reference)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "softharbor",
  "compatibility_date": "2026-07-15",
  // No "main" — pure static assets, requests are unbilled.
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page"   // serves dist/404.html with HTTP 404
  },
  "routes": [
    { "pattern": "softharbor.net", "custom_domain": true }  // docs/16 §3
  ],
  "workers_dev": false,   // canonical origin is the custom domain only
  "preview_urls": true    // explicit: defaults to workers_dev's value
}
```

Rules: never add `main` without a decision-log entry (it flips billing and
the error model); never enable `run_worker_first`; never re-enable
`workers_dev` (duplicate-content hazard — docs/16 §1/N3).
