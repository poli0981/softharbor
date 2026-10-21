# 08 — Platform: Cloudflare Workers (setup · errors · offline)

> This is the operator's guide Kokone asked for. Part A is the click-by-click
> setup; Part C answers "can Cloudflare make our error pages?" definitively;
> Part E is the one Worker the site runs since v1.1 (D25).

## Part A — Setup guide (account + zone + first deploy)

### A1. One-time account preparation

1. Log in to the Cloudflare dashboard → **Workers & Pages**.
2. If the account has no `workers.dev` subdomain yet, set it once
   (Workers & Pages → account **Subdomain**). Since the domain arrived
   (2026-07-20) it only shapes **PR preview URLs**
   (`<version>-softharbor.<subdomain>.workers.dev`) — production lives on
   `softharbor.net`.
3. Copy the **Account ID** (right sidebar of the Workers overview).
4. Onboard the `softharbor.net` zone — Free plan, nameservers, DNSSEC —
   per **docs/16 §2** (action item H2). The zone must exist before the
   custom domains can be attached (docs/16 §3).

### A2. API token (for CI) — retired

**Not used since 2026-07-28** (docs/12 §1). Deployment is Cloudflare Workers
Builds (A4), which deploys with account-level credentials; no workflow in
this repository deploys. The old `CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_ACCOUNT_ID` repository secrets are unused and should be deleted
(docs/15 §5). If a workflow ever needs a token again, it must carry zone
scopes (**Zone → Workers Routes → Edit**, **Zone → DNS → Edit**) as well as
Workers ones, and must never be committed or put in `wrangler.jsonc`.

### A3. Local deploy (bootstrap and emergencies only)

```bash
pnpm install
pnpm dlx wrangler@4 login        # one-time browser OAuth (local only)
pnpm deploy                      # = pnpm run build && wrangler deploy
```

This uploads `dist/` **and** the Worker (`main`, docs/02 §7). Since commit
66c6255 (2026-07-28) `wrangler.jsonc` declares no `routes`:
`softharbor.net` and `www.softharbor.net` are Custom Domains attached in
the dashboard (Workers & Pages → softharbor → Domains), and a deploy leaves
them untouched. Re-creating the Worker from a fresh clone therefore needs
both domains re-attached by hand (docs/16 §3), plus the runtime secret
(Part E).

**Never run `wrangler deploy` by hand while Workers Builds builds are
queued** (A4): a queued *older* build would land after yours and roll
production back. A local deploy also bypasses `ci`. Prefer merging.

Verify after any deploy: `https://softharbor.net/` renders,
`/apps/does-not-exist` returns **HTTP 404** with our page (not a blank
Cloudflare 404), `_headers` rules apply (`curl -I` shows `frame-ancestors`
— docs/09 §4), and the old `softharbor.<subdomain>.workers.dev` no longer
serves (`workers_dev: false`). Full domain checklist: docs/16 §10.

### A4. Continuous deploys & previews (Workers Builds)

- **Production:** Cloudflare **Workers Builds** — the dashboard's git
  integration, not a GitHub workflow (docs/12 §3) — builds every push to
  `main` with `pnpm run build` and deploys with `npx wrangler deploy`.
- **PR previews:** the same integration builds each PR push and uploads a
  version with `wrangler versions upload`, producing a per-version preview
  URL (enabled by `"preview_urls": true`) that it reports on the PR.
  Previews run the legal gate — expected — and carry `X-Robots-Tag:
  noindex` from `_headers` (docs/16 §3).
- **Builds run one at a time.** After a burst of PR pushes, a `main` merge
  can wait about **20 minutes** before its build starts, and a superseded
  queued build of `main` may be skipped (observed 2026-10-21: `ff95578`
  never deployed, `3743cfb` did). The **"Workers Builds" check run appears
  on a `main` commit only once its build starts** — its absence right after
  a merge means "queued", not "broken". A gap in `wrangler deployments
  list` means no commit reached `main`, nothing more.
- **Release step — verify production after every merge** (docs/13 §3):
  1. wait until the merge commit's "Workers Builds" check is green;
  2. then check production itself: the new content-hashed `/_astro/` asset
     names are served, the headers (`curl -I`), the per-page CSP meta,
     `POST /api/verify` (Part E), and `/rss.xml`;
  3. never "help" with a manual `wrangler deploy` while builds are queued
     (A3).
- The **build environment is Cloudflare's**: it must match `.nvmrc`
  (Node 24) and `packageManager` (pnpm 11), or production can differ from
  what CI validated — re-check after any toolchain bump (docs/13 §2).
- Rollback: dashboard → the Worker → **Deployments** → promote a previous
  version, or `wrangler rollback`.

### A5. Observability & limits

- Metrics: Worker → **Metrics** shows request counts and status classes.
  Static-asset requests run no code, so there is nothing to `tail` for them
  — client-side errors reach us via the bug-report flow instead (docs/05
  §A5–A6).
- **Workers Logs** (`observability.enabled`, invocation logs **off**) hold
  only the Worker's own one-line JSON events: `{event: "verify", outcome,
  ms}` per request, `verify.secret_refused` when Siteverify rejects our
  secret, `verify.crash` on an unexpected exception — never an IP address
  or a token (Part E). `wrangler tail` shows the same lines live.
- **Billing:** only requests that run the Worker are billed Worker
  requests — `run_worker_first` paths (`/api/verify`) and the rare
  non-navigation request that matches no asset (Part C). Pages, assets and
  feeds are served by the asset server and are **not billed**.
- Asset limits to respect (check current values in CF docs at setup time;
  documented limits as of writing): max ~20 000 files per deploy, 25 MiB
  per file. SoftHarbor's footprint (local build, 2026-10-21): 763 files in
  `dist/`, 701 of them HTML; the largest is `/vi/apps` at ~1.3 MB raw
  (~125 KB gzip — every card is server-rendered, docs/15 §2 item 9).
  Comfortable margins; nothing checks this automatically.

## Part B — What we deliberately do NOT configure in v1

The zone exists (Free plan) but stays minimal: **no rate-limiting rules,
no Bot Fight Mode, no Custom Errors** — each has a reason and a ready-made
activation recipe in **docs/16 §9** (short version: static assets are
unbilled so there's nothing to protect, bot challenges would break our own
`/api/apps.json` + RSS consumers, and Custom Errors is a paid-zone
feature). HSTS **is** configured — zone-level, now at phase P3 (docs/16
§5). Do not "pre-enable" anything beyond that.

Two things that look similar but are not zone features: the Worker's
**Workers Rate Limiting binding** (`VERIFY_LIMITER`, Part E) guards only
`/api/verify`, and **Turnstile** (D25) is a widget our own page loads after
consent — neither touches how pages are served. Conversely, the zone's
**Speed Brain** speculative prefetch should be **off**: Cloudflare refuses
prefetch on Worker requests with a 503, which is why `astro.config.ts` sets
`prefetch: false` (docs/16 §9 — ⚠ verify the zone setting; production still
sent a `Speculation-Rules` header on 2026-10-21).

## Part C — Error-page matrix (the definitive answer)

Background (re-verified 2026-07-20): Cloudflare **Custom Errors** is a
**paid zone-plan** feature — our zone is Free (docs/16 §1/N4) — and even
where available it does not apply to 500/501/503/505 responses. Therefore
**every error page a user can see must come from our own build output**,
and anything Cloudflare itself emits shows Cloudflare's default page. The
v1.1 Worker (Part E) changes nothing for pages: its error statuses are JSON
answers to the gate's own `fetch`, never a document.

| Status | Who generates it | What the user sees | Our artifact |
|---|---|---|---|
| 404 (navigation) | Asset server, URL matches nothing. With `compatibility_date` ≥ 2025-04-01 a navigation miss gets `404.html` **without invoking the Worker** | Our branded, bilingual page, real HTTP 404, no legal gate | `dist/404.html` via `not_found_handling: "404-page"` |
| 404 (other) | A non-navigation miss (an image, a JSON file) reaches the Worker, which returns `env.ASSETS.fetch(request)` — the same `not_found_handling` | Same 404 | same |
| 500-class (pages) | Practically cannot originate from us — no code runs for a page. Cloudflare infra errors (52x) show Cloudflare's page — not customizable on a Free zone | CF default (rare) | `/errors/500` template kept **dormant** |
| 403 (pages) | Nothing issues 403 for a page — WAF features deliberately OFF (docs/16 §9). If ever enabled on the Free zone, blocks render **Cloudflare's default page** (custom responses are paid features) | n/a | `/errors/403` dormant template |
| 429 (pages) | Nothing issues 429 for a page — zone rate limiting deliberately OFF (docs/16 §9); same Free-zone caveat as 403 | n/a | `/errors/429` dormant template |
| 4xx/5xx from `/api/verify` | The Worker: `400 invalid_json`/`invalid_token`, `403 bad_origin`/`rejected`, `405`, `413`, `415`, `429 rate_limited` (`Retry-After: 60`), `503 not_configured`/`unavailable`, `500 internal_error` | Nothing — the gate reads the status; 403 asks Turnstile for a fresh challenge, every other failure **fails open** (docs/05 §A9) | JSON body `{ "error": "<code>" }` |
| No internet | Client-side | Our offline page | `offline.html` via service worker (Part D) |

The dormant templates cost three static pages and make a future Pro-zone
Custom Errors switch-on a config-only task (docs/16 §9 recipe). Like
`/404` and `/offline` they are gate-exempt, `noindex` and bilingual on one
page (docs/06 §5).

## Part D — PWA / offline ("No Internet" page)

Scope: **an installable app with an offline fallback** — not an app-cache of
the whole site (a software directory is useless offline anyway; we just
refuse to show a browser dinosaur). Since v1.1 the manifest is linked and
has proper icons, so the site is installable; navigation still always goes
to the network.

```ts
// astro.config.ts — AstroPWA(…) (abridged)
AstroPWA({
  registerType: 'autoUpdate',
  // MUST be explicit: without it registerSW.js is emitted but referenced by
  // no page, and the SW silently never registers (S5). 'script', not
  // 'inline': an injected inline snippet would not be in the CSP hashes.
  injectRegister: 'script',
  manifest: {
    id: '/', name: 'SoftHarbor', short_name: 'SoftHarbor', lang: 'en',
    description: 'Free & buy-once desktop software, one page.',
    // The icon tile's colour (scripts/gen-icons.mjs), so the install splash
    // and title bar match the icon rather than the page.
    theme_color: '#0B4F7A', background_color: '#0B4F7A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  },
  workbox: {
    // What /offline needs, and nothing more. Coupled to build.format
    // ('offline.html', never 'offline/**') and to Astro hashing fonts and
    // CSS into _astro/ (never a /fonts/ dir) — both mistakes once matched
    // nothing, silently (M1, S5).
    globPatterns: [
      'offline.html',
      '_astro/*.css',                                // inlineStylesheets 'never'
      '_astro/{errors,theme,analytics}.*.js',        // the head scripts
      '_astro/be-vietnam-pro-{latin,vietnamese}-400-normal.*.woff2',
      '_astro/bricolage-grotesque-{latin,vietnamese}-wght-normal.*.woff2',
      'favicon.svg',
    ],
    skipWaiting: true,    // registerSW.js never posts SKIP_WAITING
    clientsClaim: true,   // control the page that installed the SW (S5)
    // MUST be the empty string, and must be present. Omitting the key does
    // NOT disable it: vite-plugin-pwa's `defaultWorkbox` sets
    // navigateFallback: 'index.html', which emitted
    // `NavigationRoute(createHandlerBoundToURL('/'))`. '/' was never
    // precached, so every SW-handled navigation threw
    // `non-precached-url :: [{"url":"/"}]` — what a visitor saw on returning
    // from an external link (2026-07-30).
    //
    // Had '/' been precached it would have been worse and quieter: that route
    // serves its bound URL for EVERY navigation, so the home page would have
    // answered every request. That is the S5 bug again. The exception was the
    // only thing making it visible.
    navigateFallback: '',
    runtimeCaching: [{
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkOnly',
      options: { precacheFallback: { fallbackURL: '/offline' } },
    }],
  },
})
```

Behavior: online navigation always hits the network (content freshness >
offline cleverness); when a navigation fails, the precached `/offline` page
renders — styled, with its scripts and the latin + Vietnamese body and
display faces. The precache is deliberately small: until v1.1 the SW
precached all 13 font files (211 KB) on a visitor's first page view, yet
missed the CSS the offline page links (it rendered unstyled exactly when
needed). Other faces fall back to system fonts offline. `Base.astro` links
`/manifest.webmanifest` (the plugin emits it but links it from no page) and
loads `/registerSW.js` with `defer`; icons come from `pnpm icons`
(`scripts/gen-icons.mjs`, output committed to `public/`).

**`pnpm check:sw` asserts this against the emitted `dist/sw.js`** — no
`NavigationRoute`, a `NetworkOnly` navigation handler with the `/offline`
fallback, `offline.html` and fonts precached, **every stylesheet and
`/_astro/` script `/offline` loads precached**, `skipWaiting()` present,
and `registerSW.js` plus the manifest link referenced from `dist/index.html`.
Every one of the service-worker bugs this project has had was silent at
build time, so the config being right is not evidence that the output is.
Spike S5 verifies: SW registers under the production origin
(`softharbor.net` — a preview URL is acceptable for early iterations, but
the final pass runs on the real origin), fallback fires in airplane mode,
`autoUpdate` swaps SW without a stale lockout, and the legal gate behaves
on the offline page (it is exempt — the page declares `gateExempt`, docs/14
Part 2).

## Part E — The `/api/verify` Worker (D25)

The one piece of server code (CLAUDE.md hard rule 1 as amended). Threat
model and the client half: docs/09 §4a, docs/05 §A9.

**Files.** `worker/index.ts` (entry: `/api/verify` → `handleVerify`,
anything else → `env.ASSETS.fetch(request)`), `worker/verify.ts` (the
endpoint), `worker/http.ts` (JSON responses, streamed body cap, rate-limit
key), `worker/env.ts` (bindings, typed by hand — `@cloudflare/workers-types`
would collide with the DOM lib the site compiles against). Tested by the
Vitest `worker` project against a stubbed Siteverify (docs/11 §2); CI also
runs `wrangler deploy --dry-run` so a config error fails before production.

**Routing.** `assets.run_worker_first: ["/api/verify"]` is the only path
that runs the Worker before the asset server. Pages, assets and feeds never
invoke it; a navigation that matches nothing gets `404.html` from the asset
server (Part C).

**Contract — `POST /api/verify`**, body `{"token": "<turnstile token>"}`:

| Check | Refusal |
|---|---|
| method is POST | `405` + `Allow: POST` |
| `Origin` equals the origin the request arrived on (works on previews and `wrangler dev` without a host list) | `403 bad_origin` |
| `TURNSTILE_SECRET` present | `503 not_configured` |
| rate limit — 20 per 60 s per IPv4 address or IPv6 /64 (`VERIFY_LIMITER`) | `429 rate_limited`, `Retry-After: 60` |
| `Content-Type` exactly `application/json` (what a cross-site form or no-preflight fetch cannot send) | `415` |
| body ≤ 4 KB — `Content-Length` checked, then counted **while streaming** | `413` |
| valid JSON with a non-empty string `token` ≤ 2048 chars | `400 invalid_json` / `invalid_token` |
| Siteverify says success, `hostname` = request host, `action` = `legal_gate`, `challenge_ts` ≤ 300 s old | `403 rejected` |
| Siteverify cannot answer (network error or 5xx twice, a 4xx or non-JSON reply, `internal-error`) or refuses our secret | `503 unavailable` |

Success is `200 {"ok":true}`. Siteverify is called with the secret, the
token, `remoteip` (the `CF-Connecting-IP`, never logged) and an
**idempotency key**; a network error or 5xx is retried **once with the same
key**, so the retry is answered instead of calling the token spent (4 s
timeout per attempt). Cloudflare's documented test secrets (`1x…`, `2x…`,
`3x…`) skip the hostname/action/age comparison, whose values they fake.

Every response is `no-store` JSON with its own security headers —
`Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`,
`Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy`,
`X-Content-Type-Options` — because `public/_headers` applies to asset
responses only, never to what Worker code returns.

**Fail open, always.** The verdict only decides how long the gate remembers
the visitor (48 h after a pass, 1 h otherwise — docs/05 §A9). It never
blocks a page: no secret, a Siteverify outage, the rate limit, a blocked
script — all let the person in.

**Secrets.** `TURNSTILE_SECRET` is a **runtime** secret: dashboard →
Workers & Pages → softharbor → Settings → Variables and Secrets, or
`wrangler secret put TURNSTILE_SECRET`. A Workers Builds *build* variable is
invisible to the Worker at runtime. Missing → every check answers 503 and
the gate fails open, so the site works but nobody is verified — check it
after re-creating the Worker (docs/13 §2). Set in production: verified
2026-10-21 — a junk token got `403 {"error":"rejected"}`, not
`503 not_configured`. For `wrangler dev`, copy `.dev.vars.example` to
`.dev.vars` (git-ignored): it holds Cloudflare's always-pass **test**
secret, which pairs with the test sitekey the gate uses on localhost. The
sitekey itself is public by design and lives in `src/lib/turnstile.ts`.

**Logs.** One line per request — `{event: "verify", outcome, ms}` — plus
`verify.secret_refused` (our secret was rejected: ours to fix) and
`verify.crash`. Never an IP address, never a token; invocation logs are off
in `wrangler.jsonc`.

## Appendix — Future custom-domain package (superseded in v1.1)

`softharbor.net` was purchased pre-launch (2026-07-20); the package was
redesigned with re-verified platform facts and now lives as **docs/16**.
Kept here only so old links resolve. Deltas versus the plan that used to
sit in this appendix, for the record:

- HSTS is configured **zone-level and phased** (docs/16 §5), not pasted
  into `_headers`, and `preload` is a separate explicit decision (H9).
- `www` → apex uses **zone Redirect Rules** — the static `_redirects` file
  cannot match hostnames and stays reserved for path-level slug renames.
- Rate limiting and Bot Fight Mode are **deliberately OFF**, not enabled by
  default (reasons + recipes: docs/16 §9); on the Free zone their block
  pages would be Cloudflare defaults anyway.
- The workers.dev route is **disabled** (`workers_dev: false`) rather than
  served-with-noindex — cleaner than the old "decide then" note.
