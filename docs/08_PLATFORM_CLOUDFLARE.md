# 08 — Platform: Cloudflare Workers (setup · errors · offline)

> This is the operator's guide Kokone asked for. Part A is the click-by-click
> setup; Part C answers "can Cloudflare make our error pages?" definitively;
> Part E is the one Worker the site runs since v1.1 (D25), and Part F the
> site-wide rate limit it has run since v1.3 (D32).

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
  (Node 26 since 2026-10-23; the image preinstalls only 22 and 24, so 26 is
  downloaded per build) and `packageManager` (pnpm 11), or production can
  differ from what CI validated — re-check after any toolchain bump
  (docs/13 §2). Node 25+ ships no Corepack; should a build ever fail to find
  pnpm, the Workers Builds variable `PNPM_VERSION=11.15.1` is the fix.
- Rollback: dashboard → the Worker → **Deployments** → promote a previous
  version, or `wrangler rollback`.

### A5. Observability & limits

- Metrics: Worker → **Metrics** shows request counts and status classes.
  Static-asset requests run no code, so there is nothing to `tail` for them
  — client-side errors reach us via the bug-report flow instead (docs/05
  §A5–A6).
- **Workers Logs** (`observability.enabled`, invocation logs **off**) hold
  only the Worker's own one-line JSON events: `{event: "verify", outcome,
  ms}` per verification, `verify.secret_refused` when Siteverify rejects our
  secret, `verify.crash` on an unexpected exception, `{event:
  "rate_limited", kind}` per refused request — never an IP address or a
  token (Parts E and F). A request that passes logs nothing. `wrangler tail` shows the same lines live.
- **Billing:** only requests that run the Worker are billed Worker
  requests. Since D32 that is every page, feed and data file —
  `run_worker_first` is `/*` minus the files a page loads (Part F) — while
  `/_astro/*`, icons and the service worker stay on the asset server and
  are **not billed**.
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
**Workers Rate Limiting bindings** — `SITE_LIMITER` for every page, feed
and data request (Part F, D32) and `VERIFY_LIMITER` for `/api/verify`
(Part E) — and **Turnstile** (D25), a widget our own page loads after
consent. The zone's rate-limiting rule stays off; the Worker's limit is
configured in `wrangler.jsonc` and answers with our own 429 page. Conversely, the zone's
**Speed Brain** speculative prefetch should be **off**: Cloudflare refuses
prefetch on Worker requests with a 503, which is why `astro.config.ts` sets
`prefetch: false` (docs/16 §9 — ⚠ verify the zone setting; production still
sent a `Speculation-Rules` header on 2026-10-21).

## Part C — Error-page matrix (the definitive answer)

Background (re-verified 2026-07-20): Cloudflare **Custom Errors** is a
**paid zone-plan** feature — our zone is Free (docs/16 §1/N4) — and even
where available it does not apply to 500/501/503/505 responses. Therefore
**every error page a user can see must come from our own build output**,
and anything Cloudflare itself emits shows Cloudflare's default page.
`/api/verify` (Part E) answers the gate's own `fetch` in JSON, never with a
document. Since D32 the Worker runs first for pages too (Part F), and its
one page-level answer is our own 429.

| Status | Who generates it | What the user sees | Our artifact |
|---|---|---|---|
| 404 | The asset server, URL matches nothing. Since D32 the request reaches it through the Worker's `env.ASSETS.fetch(request)`, which applies the same `not_found_handling`; a miss under an asset-first pattern (`/_astro/*`, icons) gets it directly | Our branded, bilingual page, real HTTP 404, no legal gate | `dist/404.html` via `not_found_handling: "404-page"` |
| 500-class (pages) | Practically cannot originate from us: the Worker in front of pages only counts and hands over, and catches every limiter failure (Part F); an uncaught exception would show Cloudflare's 1101 page. Cloudflare infra errors (52x) show Cloudflare's page — not customizable on a Free zone | CF default (rare) | `/errors/500` template kept **dormant** |
| 403 (pages) | Nothing issues 403 for a page — WAF features deliberately OFF (docs/16 §9). If ever enabled on the Free zone, blocks render **Cloudflare's default page** (custom responses are paid features) | n/a | `/errors/403` dormant template |
| 429 (pages) | The Worker's site-wide rate limit (Part F, D32): over 60 requests per 10 s from one address. The zone rule stays OFF (docs/16 §9) | Our branded, bilingual page, real HTTP 429, `Retry-After: 10`, no legal gate | `/errors/429` — **live** since D32 |
| 429 (`/api/*`) | The same limit, for the data endpoints and `/api/verify` | JSON `{ "error": "rate_limited" }`, `Retry-After: 10`; CORS-readable on the dataset | — |
| 4xx/5xx from `/api/verify` | The Worker: `400 invalid_json`/`invalid_token`, `403 bad_origin`/`rejected`, `405`, `413`, `415`, `429 rate_limited` (`Retry-After: 60` from its own limit, 10 from the site-wide one), `503 not_configured`/`unavailable`, `500 internal_error` | Nothing — the gate reads the status; 403 asks Turnstile for a fresh challenge, every other failure **fails open** (docs/05 §A9) | JSON body `{ "error": "<code>" }` |
| No internet | Client-side | Our offline page | `offline.html` via service worker (Part D) |

The two dormant templates (403, 500) cost two static pages and make a
future Pro-zone Custom Errors switch-on a config-only task (docs/16 §9
recipe); the 429 one has been live since D32. Like
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

## Part E — The `/api/verify` endpoint (D25)

The one piece of server code (CLAUDE.md hard rule 1 as amended). Threat
model and the client half: docs/09 §4a, docs/05 §A9.

**Files.** `worker/index.ts` (entry: the site-wide limit first — Part F —
then `/api/verify` → `handleVerify`, anything else →
`env.ASSETS.fetch(request)`), `worker/limit.ts` (Part F), `worker/verify.ts`
(the endpoint), `worker/http.ts` (JSON responses, streamed body cap, rate-limit
key), `worker/env.ts` (bindings, typed by hand — `@cloudflare/workers-types`
would collide with the DOM lib the site compiles against). Tested by the
Vitest `worker` project against a stubbed Siteverify (docs/11 §2); CI also
runs `wrangler deploy --dry-run` so a config error fails before production.

**Routing.** Until D32 `/api/verify` was the only path that ran the
Worker before the asset server. Now every request except the files a page
loads does (Part F), and each one passes the site-wide limit before it
reaches this endpoint — whose own, stricter limit comes on top.

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

## Part F — The site-wide rate limit (D32)

**What runs it.** `assets.run_worker_first` is `/*` minus the files a page
loads once it has passed: `/_astro/*` (content-hashed JS, CSS and fonts),
`/icons/*`, the two favicons, `apple-touch-icon.png`,
`manifest.webmanifest`, `sw.js`, `registerSW.js` and `workbox-*.js`.
Negative patterns win over `/*` whatever the order. Every other request —
every page in both locales, `/rss.xml`, the sitemaps, `/search-index.json`,
`/api/apps.json`, `/api/verify`, `robots.txt`, `security.txt`, a miss that
ends on the 404 page — runs `worker/index.ts` first, which spends one unit
of `SITE_LIMITER` (`worker/limit.ts`) and, under the limit, hands the
request to `env.ASSETS.fetch()` unchanged.

**The limit.** 60 requests per 10 s per IPv4 address or IPv6 /64 (`rateKey`,
the same key as Part E), per Cloudflare location, namespace `4102`. That is
six a second, sustained: a person reading spends one per page, and what it
stops is a flood or a scraper running flat out. Generous on purpose,
because a school, an office or a mobile carrier's NAT puts many people
behind one address. `/api/verify` keeps its own 20 per 60 s on top
(Part E).

**What it really counts — measured on the PR preview, 2026-10-26.**
Cloudflare calls the binding "permissive, eventually consistent": each
machine counts locally and shares its counts in the background. In
practice that sharing barely shows:

| Burst (one client address) | Result |
|---|---|
| 120 requests over **one keep-alive connection**, ~11 s | 61 × `200`, then 59 × `429` — the limit, almost to the request |
| 1 500 requests, **a new connection each** (30 in parallel), ~20 a second for 79 s | 0 × `429` (1 487 × `200`, 12 local connection errors, one `500` whose cause version URLs cannot log) |
| Production `VERIFY_LIMITER`, 40 `POST /api/verify` in 33 s, a new connection each | 0 × `429` against 20 per 60 s |

So the Worker's limit holds a client that **reuses its connection** —
every browser (one HTTP/2 connection per origin) and most scrapers — and
answers it with our own page. A flood that opens a fresh connection per
request spreads over many machines and mostly slips past it; stopping that
is the job of the zone rule, which counts per IP at the edge before the
Worker runs: **layer 1, recommended** (docs/16 §9.1). Neither layer locks
out a person reading normally.

**Over the limit:**

| Request | Answer |
|---|---|
| `/api/*` | `429 {"error":"rate_limited"}`, `Retry-After: 10`, `no-store`, the Worker's own security headers — plus `Access-Control-Allow-Origin: *` and `Access-Control-Expose-Headers: Retry-After` on everything but `/api/verify`: the dataset is CORS-open, so its refusal must be readable cross-origin, or a consumer sees a network error instead |
| anything else | The built `/errors/429` page (bilingual, gate-exempt, `noindex`) with status **429**, `Retry-After: 10`, `Cache-Control: no-store` and no `ETag`; every other header is the asset server's (`_headers`). `HEAD` gets the headers only. If that page cannot be fetched, a plain-text 429 |

The 429 page's own CSS, JS and fonts are under `/_astro/` and never
limited, so it renders whole. The service worker's navigation route is
NetworkOnly and a 429 is a response, not a failure, so the visitor sees
our page rather than the offline fallback.

**Fails open.** No `SITE_LIMITER` binding, no `CF-Connecting-IP` (no client
to tell apart — one shared bucket would throttle strangers together), or a
limiter that throws: the request is served as if there were no limit.

**`_headers` still apply.** What `env.ASSETS.fetch()` returns carries
`public/_headers` exactly as a direct asset response does — measured under
`wrangler dev` and on the PR preview on 2026-10-26 (frame-ancestors,
`X-Frame-Options`, nosniff, the workers.dev `X-Robots-Tag`, the `/_astro/*`
and `/api/apps.json` `Cache-Control`; and on a refused page the same set
plus `Retry-After: 10` and `no-store`). Moving pages behind the Worker
changed no header.

**Billing.** Every routed request is now a billed Worker invocation. The
account is on Workers Paid: 10 million requests and 30 million
CPU-milliseconds a month included, then $0.30 per million requests and
$0.02 per million CPU-ms; Workers Logs include 20 million events a month
(Cloudflare's pricing page, read 2026-10-26 — Logs move to Observability
pricing on 2026-12-01). A page view costs one invocation and well under a
millisecond of CPU, and the files a page loads stay free ("requests to
static assets are free and unlimited"). A refused request
is billed too — the limit makes a flood cheap to answer, not free. A flood
large enough to matter is the job of Cloudflare's automatic DDoS
protection and of the zone rate-limiting rule (docs/16 §9.1), both of
which act before the Worker runs, so what they block is never billed —
the rule at the price of Cloudflare's default block page.

**Logs.** One line per refusal, `{event: "rate_limited", kind: "page" |
"api"}` — never the address; a request that passes logs nothing. Rate
limiting bindings have no dashboard of their own, so these lines (Workers
Logs, `wrangler tail`) are the only record of how often the limit fires —
read them before tuning it.

**Tests.** Unit: `worker/limit.test.ts` (stubbed limiter and asset server;
`wrangler.jsonc` is read with wrangler's `unstable_readConfig` to hold
`period` equal to `RETRY_AFTER_S` and keep the negative patterns). End to
end: the Playwright project `worker` (`e2e/worker.spec.ts`) starts `wrangler
dev` on `dist/` with the real config — Miniflare simulates the binding in
fixed windows aligned to the clock, without counting refusals — and floods
it: exactly the configured 60 × 200 and then 429s, the 429 page rendered
and styled in Chrome, `/api/*` answering JSON, a page's own files still
200, everyone back in when the window passes. On a deployed version: the
burst check in docs/13 §2.

**Tuning.** Change `limit` in `wrangler.jsonc` with a decision-log line;
`period` must stay equal to `RETRY_AFTER_S` (a test holds them together).
Keep namespace ids unique on the account — bindings that share one share
their counters, across Workers too.

## Appendix — Future custom-domain package (superseded in v1.1)

`softharbor.net` was purchased pre-launch (2026-07-20); the package was
redesigned with re-verified platform facts and now lives as **docs/16**.
Kept here only so old links resolve. Deltas versus the plan that used to
sit in this appendix, for the record:

- HSTS is configured **zone-level and phased** (docs/16 §5), not pasted
  into `_headers`, and `preload` is a separate explicit decision (H9).
- `www` → apex uses **zone Redirect Rules** — the static `_redirects` file
  cannot match hostnames and stays reserved for path-level slug renames.
- Rate limiting and Bot Fight Mode are **deliberately OFF** at the zone,
  not enabled by default (reasons + recipes: docs/16 §9); on the Free zone
  their block pages would be Cloudflare defaults anyway. Since D32 rate
  limiting lives in the Worker instead (Part F), with our own 429 page.
- The workers.dev route is **disabled** (`workers_dev: false`) rather than
  served-with-noindex — cleaner than the old "decide then" note.
