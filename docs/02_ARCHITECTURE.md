# 02 — Architecture

## 1. Shape of the system

Static-first. The repository *is* the database; a deploy *is* a data
migration. Everything a visitor reads is a prebuilt static asset; since
v1.1 one small Worker answers exactly one endpoint (D25).

```
 maintainer PR ──▶ CI (ci.yml build + gates, codeql) ──▶ squash to main
                                                             │
                     Cloudflare Workers Builds ◀─────────────┘
                     (pnpm run build → npx wrangler deploy; docs/12 §3)
                                        │  dist/ + worker/
                                        ▼
                     Cloudflare Workers Static Assets — softharbor.net
                       pages, assets, feeds ─▶ asset server (unbilled)
                       POST /api/verify ─────▶ worker/index.ts (D25)
                                        │
                                        ▼
                                     Browser
                     static HTML/CSS  +  6 Svelte islands (client JS)
                     search index & app JSON fetched from same origin
                     third-party, started only by our own code (rule 7):
                       Cloudflare Web Analytics beacon (D26, never under GPC)
                       Cloudflare Turnstile (gate step 2, after acceptance)
```

Consequences (accepted, documented):

- No SSR, no database, no page ever produced by server code. The only
  server code is `worker/`, which answers `POST /api/verify` (the legal
  gate's Turnstile check) and runs only for the paths in
  `assets.run_worker_first`; every page, asset and feed is served by the
  asset server without invoking it (§7, docs/08 Part E).
- "Dynamic" behaviors are relocated: data mutation → Git + GitHub Actions;
  personalization → localStorage; search → client-side index; shareable
  view state → the URL (docs/05 §A3).
- Logs: Cloudflare's dashboard metrics for the site, plus Workers Logs for
  the Worker's own one-line JSON events (outcome and duration — never an IP
  or a token; invocation logs off).
- 403/429 can now come from us, but only as JSON answers from
  `/api/verify` that the gate consumes and fails open on — never as a page.
  Page-level 403/429 still cannot happen: the zone's security features
  (rate limiting, Bot Fight Mode) are deliberately OFF (docs/16 §9), so the
  templates stay dormant (docs/08 Part C).

## 2. Project tree

```
softharbor/
├── CLAUDE.md                      # AI dev instructions (hard rules)
├── LICENSE                        # GPL-3.0-only (GitHub picker)
├── LICENSE-DATA.md                # CC BY-SA 4.0 for src/data/** (docs/14 §1)
├── SECURITY.md                    # reporting policy (docs/09 §5)
├── CONTRIBUTING.md / CODE_OF_CONDUCT.md
├── CHANGELOG.md                   # Keep-a-Changelog, features only (docs/13 §1)
├── README.md                      # overview, commands, contacts
├── astro.config.ts                # §4
├── wrangler.jsonc                 # §7
├── vitest.config.ts / playwright.config.ts   # docs/11
├── package.json / pnpm-lock.yaml / .nvmrc / .npmrc
├── pnpm-workspace.yaml            # allowBuilds + overrides (docs/09 §7)
├── eslint.config.js / prettier.config.mjs / .prettierignore
├── knip.json / lefthook.yml       # docs/10 §4
├── .dev.vars.example              # Turnstile TEST secret for `wrangler dev`
├── .sonarcloud.properties / .gitattributes / .gitignore
├── .github/
│   ├── CODEOWNERS                 # * @poli0981 + .github/ scripts/ src/data/ worker/ (T6)
│   ├── dependabot.yml             # npm + github-actions, weekly (docs/12 §6)
│   ├── ISSUE_TEMPLATE/            # bug_report.yml · app_request.yml · config.yml
│   └── workflows/                 # docs/12: ci.yml · codeql.yml · notify.yml
│                                  #   quarantine.yml · link-check.yml
│                                  #   (NO deploy/preview — Cloudflare Workers
│                                  #    Builds owns deployment, docs/12 §3)
├── data/
│   └── quarantine/                # flagged apps parked here (docs/03 §5);
│                                  #   created by `pnpm quarantine` on first use
├── worker/                        # the ONE Worker (D25, docs/08 Part E)
│   ├── index.ts                   # /api/verify → verify.ts, else ASSETS.fetch()
│   ├── verify.ts                  # POST /api/verify → Turnstile Siteverify
│   ├── http.ts                    # JSON responses, body cap, rate-limit key
│   ├── env.ts                     # bindings, typed by hand
│   └── *.test.ts                  # Vitest `worker` project (docs/11)
├── e2e/                           # Playwright + axe on the build (docs/11 §5)
├── scripts/
│   ├── validate-data.mjs          # L2 cross-file data rules (docs/03 §2)
│   ├── check-i18n-parity.mjs      # EN/VI key parity (docs/07 §3)
│   ├── quarantine.mjs             # `pnpm quarantine` — move flagged entries
│   ├── extract-urls.mjs           # URL list for lychee (docs/12 §5)
│   ├── postbuild.mjs              # CSP meta first in <head> (docs/09 §4)
│   ├── check-csp.mjs              # dist/ markup vs its own page's CSP
│   ├── check-assets.mjs           # referenced assets exist; no data: scripts
│   ├── check-service-worker.mjs   # emitted sw.js matches docs/08 Part D
│   ├── check-feed.mjs             # emitted rss.xml guids/links/order (§A4)
│   ├── gen-icons.mjs              # `pnpm icons` — favicon + PWA PNGs
│   └── fixture.ts / *.test.ts     # each script run for real (docs/11 §2)
├── public/
│   ├── _headers                   # security + cache headers (docs/09 §4)
│   ├── robots.txt
│   ├── .well-known/security.txt
│   ├── favicon.svg / favicon.ico / apple-touch-icon.png
│   └── icons/                     # PWA PNGs: 192, 512, maskable-512
│                                  # (no _redirects yet — docs/16 §4)
└── src/
    ├── content.config.ts          # Zod collections: apps, categories
    ├── data/
    │   ├── apps/*.json            # ONE file per app, filename = slug
    │   └── categories.json        # category registry (docs/04 §4)
    ├── assets/logos/              # vendor SVGs for `local:` logos (none yet)
    ├── i18n/
    │   ├── en.json / vi.json      # UI dictionaries
    │   └── index.ts               # typed t() + appCount() (docs/07 §3)
    ├── scripts/                   # head scripts: plain classic JS, emitted as
    │   ├── errors.js              #   hashed /_astro/ files (§4) — ring buffer
    │   ├── theme.js               #   (docs/05 §A5), pre-paint display prefs
    │   └── analytics.js           #   (§A8), Web Analytics loader (D26)
    ├── lib/
    │   ├── normalize.ts           # VN-insensitive normalizer (docs/05 §A1)
    │   ├── searchOptions.ts       # MiniSearch options, shared (docs/05 §A2)
    │   ├── search.ts              # build-time index factory
    │   ├── searchIndex.ts         # client loader: fetch + import('minisearch')
    │   ├── stores.ts              # nanostores: query/facets/sort (§A3)
    │   ├── filter.ts / grid.ts    # pure filter+sort / grid controller (§A3)
    │   ├── urlstate.ts            # ?q&cat&platform&pricing&sort (§A3)
    │   ├── legal.ts / human.ts    # sh:legal, sh:human (docs/05 §A7, §A9)
    │   ├── turnstile.ts           # gate step 2, browser half (docs/09 §4a)
    │   ├── theme.ts / prefs.ts / lang.ts   # typed storage helpers
    │   ├── contacts.ts            # one address per purpose (D27)
    │   ├── inlineCss.ts           # the one inline <style> (§6)
    │   ├── locale.ts / paths.ts   # locale routing, shared getStaticPaths
    │   ├── feed.ts                # RSS items + /api/apps.json export
    │   ├── icon.ts / logo.ts      # build-time SVG inlining (docs/04 §2)
    │   ├── licenses.ts            # third-party table at build (docs/14 §3e)
    │   ├── ringbuffer.ts          # reader for errors.js (docs/05 §A5)
    │   └── issueUrl.ts            # bug-report URL builder (docs/05 §A6)
    ├── components/
    │   ├── Sh*.astro              # static: ShAppCard, ShHeader, ShFooter,
    │   │                          #   ShIcon (Lucide, build-time), ShJsonLd
    │   ├── legal/*.astro          # the six documents, EN + VI (docs/14)
    │   ├── pages/*.astro          # shared page bodies, one per route shape;
    │   │                          #   src/pages/** are thin locale wrappers
    │   │                          #   so EN and VI cannot drift (docs/07 §2)
    │   └── islands/Sh*.svelte     # the 6 islands (§5)
    ├── layouts/Base.astro         # head scripts, gate, header, footer
    ├── styles/
    │   ├── global.css             # @theme tokens (docs/06 §2)
    │   └── contrast.test.ts       # WCAG AA for every token pair
    └── pages/
        ├── index.astro                       # Welcome
        ├── apps/index.astro                  # grid + search island
        ├── apps/[slug].astro                 # detail (getStaticPaths)
        ├── categories/index.astro            # category index
        ├── categories/[id].astro
        ├── legal/{disclaimer,privacy,terms,trademarks,third-party,
        │         ai-disclosure}.astro
        ├── contact.astro                     # one address per purpose (D27)
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
| `/` | `/vi` | `index.astro` | Welcome: hero, manifest ledger, category grid, principles |
| `/apps` | `/vi/apps` | `apps/index.astro` | Grid; search/filter islands; view state in the query string (docs/05 §A3) |
| `/apps/[slug]` | `/vi/apps/[slug]` | `[slug].astro` | One page per app; `getStaticPaths` over the collection |
| `/categories` | `/vi/categories` | `categories/index.astro` | One tile per category |
| `/categories/[id]` | `/vi/categories/[id]` | `[id].astro` | SEO landing per category |
| `/legal/*` | `/vi/legal/*` | `LegalPage` + `components/legal/*` | Six documents; gate-exempt (docs/14 Part 2) |
| `/contact` | `/vi/contact` | `contact.astro` | One address per purpose (D27); gate-exempt |
| `/404` | — | `404.astro` | Served via `not_found_handling`; one bilingual page; gate-exempt |
| `/offline` | — | `offline.astro` | SW navigation fallback; one bilingual page; gate-exempt |
| `/errors/{403,429,500}` | — | templates | Dormant — Free zone, nothing issues them (docs/08 Part C) |
| `/api/apps.json` | — | endpoint | Full dataset export (docs/03 §6) |
| `/search-index.json` | — | endpoint | Serialized MiniSearch index, lazy-loaded |
| `/rss.xml` | — | endpoint | Latest additions feed |
| `POST /api/verify` | — | `worker/` | The only route that runs code (D25, docs/09 §4a) |

Every page route is prebuilt: 701 HTML files in `dist/` as of 2026-10-21
(326 apps × 2 locales plus the rest). Pages without a VI mirror (404,
offline, error templates) are single bilingual documents and emit no
hreflang alternates (docs/07 §6).

## 4. Astro configuration (reference)

```ts
// astro.config.ts (excerpt — the file itself carries the full reasoning)
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

export default defineConfig({
  site: 'https://softharbor.net',
  output: 'static',
  // ONE decision with wrangler's html_handling (§7) — spike S1, measured.
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'never' },
  prefetch: false,          // Cloudflare 503s speculative Worker requests
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'vi'],
    routing: { prefixDefaultLocale: false },
  },
  // Per-page <meta http-equiv="content-security-policy"> with hashes for
  // the inline snippets Astro generates (D20, docs/09 §4). _headers carries
  // ONLY frame-ancestors: both policies are enforced, so script-src there
  // too would intersect and break every island.
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' https://cloudflareinsights.com",   // D26 beacon
        'frame-src https://challenges.cloudflare.com',          // D25 widget
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "object-src 'none'",
      ],
      // `resources` REPLACES Astro's default, so 'self' must be listed or
      // every same-origin script — islands included — is refused.
      scriptDirective: {
        resources: [
          "'self'",
          'https://static.cloudflareinsights.com',   // D26
          'https://challenges.cloudflare.com',       // D25
        ],
      },
      // The one is:inline <style> (§6). Astro hashes only what it bundles.
      styleDirective: {
        hashes: [
          `sha256-${createHash('sha256').update(VIEW_TRANSITION_OPT_IN).digest('base64')}`,
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
    AstroPWA(/* docs/08 Part D */),
  ],
  vite: {
    // ~icons/<set>/<name> compiles to Svelte components (islands); .astro
    // files use ShIcon / src/lib/icon.ts instead (docs/10 §3).
    plugins: [tailwindcss(), Icons({ compiler: 'svelte' })],
  },
});
```

Notes on the non-obvious keys:

- **`build.format: 'file'`** makes `/apps` the asset itself (`apps.html`);
  with `html_handling: "drop-trailing-slash"` the canonical no-slash URL is
  the one that serves 200 (S1). Side effect: `Astro.url.pathname` is the
  emitted *file* name, so everything user-facing goes through
  `canonicalPath()` (docs/07 §6).
- **`inlineStylesheets: 'never'`** began as a CSP fix under the former
  `<ClientRouter />` (a soft navigation refused a page-specific inline
  stylesheet hashed only into the page it came from) and stays as a cache
  decision: external CSS needs no hash and is cached once across ~700 pages.
- **`prefetch: false`** because Cloudflare answers a `Sec-Purpose: prefetch`
  request on a Worker with a bare 503 (`Cf-Speculation-Refused`); the zone's
  Speed Brain hits the same refusal (docs/16 §9).
- **Head scripts** (`src/scripts/*.js`) are imported in `Base.astro` with
  `?url&no-inline`: Vite copies them verbatim to content-hashed `/_astro/`
  files cached immutably. Plain `?url` would inline files under 4 KiB as
  `data:` URLs, which `script-src 'self'` refuses — `check:assets` guards it.

`pnpm build` is the composite every environment runs (CI, Workers Builds,
laptops): `validate:data → i18n:check → astro build → postbuild:html →
check:csp → check:assets → check:sw → check:feed` (docs/12 §2).

## 5. Islands & hydration budget

| Island | Directive | Why |
|---|---|---|
| `ShLegalGate.svelte` | `client:load`, rendered by `Base.astro` unless the page declares `gateExempt` | Must block interaction immediately; mounts afresh on every page (§6, docs/14 Part 2) |
| `ShSearch.svelte` | `client:idle` | Grid is readable without it; mounts the grid controller (`src/lib/grid.ts`), restores the view from the URL; index and MiniSearch load on first focus/keystroke |
| `ShFilterSheet.svelte` | `client:idle` | Shares nanostores with search |
| `ShLangSwitch.svelte` | `client:idle` | Server-rendered EN⇄VI pair; carries `?query#hash` across; persists `sh:lang` |
| `ShPrefs.svelte` | `client:idle` | Display menu — theme, scrollbar, motion — that replaced `ShThemeToggle` in v1.1; also the global `/` shortcut off `/apps`. `theme.js` has already applied all three pre-paint |
| `ShBugReport.svelte` | `client:visible` (footer) | Reads the ring buffer `errors.js` fills; opens prefilled issue URL |

Everything else is `.astro` with zero client JS — including the welcome
page's search field and the header's search hint, which are plain links to
`/apps#search`. Adding a seventh island requires a decision-log entry;
`ShPrefs` replaced `ShThemeToggle` one-for-one, so the count is still six.

## 6. View Transitions

**Native cross-document View Transitions since v1.1; `<ClientRouter />` is
gone.** Astro does not support ClientRouter together with `security.csp`,
and in practice the soft navigation kept the *first* page's meta CSP, wiped
`<html data-theme>`, and kept module state alive while islands reset — the
theme flicker and stale sort of v1.0. Every navigation is now a full
document load with its own CSP and its own island tree.

- The opt-in is
  `@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}`
  — an **inline, hashed `<style>`** in `Base.astro`, from
  `src/lib/inlineCss.ts`, whose hash `astro.config.ts` supplies (§4). It
  cannot live in `global.css`: Chromium decides the new page's opt-in when
  the parser inserts `<body>`, counting only stylesheets already loaded, and
  the bundled CSS links come after the blocking head scripts.
- Browsers without support simply navigate. `theme.js` marks the
  transition promises handled on `pageswap`/`pagereveal`, so an aborted fade
  never lands in the bug-report buffer as an unhandled rejection.
- No `transition:persist`, no `transition:name`, no `astro:after-swap`
  handlers anywhere. Islands remount per page; nanostores live for one page;
  **the URL is the durable view state** (`?q&cat&platform&pricing&sort`,
  `src/lib/urlstate.ts`, docs/05 §A3).
- The legal gate mounts on every non-exempt page and re-reads `sh:legal` /
  `sh:human`; there is nothing to carry across navigations.
- Reduced motion — OS setting or the display menu's `data-motion="reduce"` —
  removes the fade (docs/06 §7). The card→detail morph stays withdrawn
  (docs/06 §7).

## 7. wrangler.jsonc (reference)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "softharbor",
  "main": "./worker/index.ts",            // D25 — POST /api/verify only
  // ≥ 2025-04-01: a NAVIGATION that matches no asset gets dist/404.html from
  // the asset server without invoking the Worker (docs/08 Part C).
  "compatibility_date": "2026-10-01",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "404-page",     // serves dist/404.html with HTTP 404
    // MUST agree with astro's trailingSlash 'never' + build.format 'file'.
    // Measured in S1 on a real deploy: "auto-trailing-slash" 307s /apps to
    // /apps/, contradicting every canonical; this makes /apps the 200.
    "html_handling": "drop-trailing-slash",
    // The only path that runs the Worker before the asset server.
    "run_worker_first": ["/api/verify"]
  },
  // Workers Rate Limiting for /api/verify: 20 per 60 s per IPv4 address or
  // IPv6 /64, per Cloudflare location. namespace_id is account-wide.
  "ratelimits": [
    { "name": "VERIFY_LIMITER", "namespace_id": "4101",
      "simple": { "limit": 20, "period": 60 } }
  ],
  // Workers Logs keep the Worker's own JSON lines; invocation logs are off.
  "observability": {
    "enabled": true,
    "logs": { "enabled": true, "invocation_logs": false }
  },
  // No "routes" (since commit 66c6255, 2026-07-28): softharbor.net and
  // www.softharbor.net are Custom Domains attached in the dashboard, which a
  // deploy then leaves untouched (docs/16 §2.2, §3).
  "workers_dev": false,   // canonical origin is the custom domain only
  "preview_urls": true    // PR previews; _headers marks them noindex
}
```

Rules:

- `main` exists since D25 and serves **only** `/api/verify`. Adding any
  path to `run_worker_first` — or letting the Worker serve, gate or rewrite
  a page — needs a decision-log entry: every match is a billed invocation,
  and hard rule 1 allows one route.
- Never re-enable `workers_dev` (duplicate-content hazard — docs/16 §1/N3).
- Do not re-add `routes` without re-reading docs/16 §2.2: a deploy
  reconciles the Worker's triggers, which is how `www` was lost once.
- The Turnstile secret is **not** in this file and never in the repo: it is
  a runtime secret, `TURNSTILE_SECRET` (docs/08 Part E).
