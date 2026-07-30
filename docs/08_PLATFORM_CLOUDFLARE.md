# 08 — Platform: Cloudflare Workers (setup · errors · offline)

> This is the operator's guide Kokone asked for. Part A is the click-by-click
> setup; Part C answers "can Cloudflare make our error pages?" definitively.

## Part A — Setup guide (account + zone + first deploy)

### A1. One-time account preparation

1. Log in to the Cloudflare dashboard → **Workers & Pages**.
2. If the account has no `workers.dev` subdomain yet, set it once
   (Workers & Pages → account **Subdomain**). Since v1.1 it only shapes
   **PR preview URLs** (`<version>-softharbor.<subdomain>.workers.dev`) —
   production lives on `softharbor.net`.
3. Copy the **Account ID** (right sidebar of the Workers overview).
4. Onboard the `softharbor.net` zone — Free plan, nameservers, DNSSEC —
   per **docs/16 §2** (action item H2). The zone must exist before the
   first deploy, because `wrangler.jsonc` declares the custom-domain route.

### A2. API token (for CI)

Dashboard → My Profile → **API Tokens** → Create Token → template
**"Edit Cloudflare Workers"** → scope it to *this account only* → create,
copy once. Then in GitHub repo → Settings → Secrets and variables →
Actions:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token above |
| `CLOUDFLARE_ACCOUNT_ID` | account id from A1.3 |

Never put the token in `wrangler.jsonc` or commit it anywhere.

### A3. Local first deploy (sanity check before CI exists)

```bash
pnpm build                       # → dist/
pnpm dlx wrangler@4 login        # one-time browser OAuth (local only)
pnpm dlx wrangler@4 deploy       # reads wrangler.jsonc (docs/02 §7)
```

The `routes` block in `wrangler.jsonc` (docs/02 §7) makes this deploy also
attach `softharbor.net` to the Worker: the apex DNS record and certificate
are provisioned automatically. Verify: `https://softharbor.net/` renders,
`/apps/does-not-exist` returns **HTTP 404** with our page (not a blank
Cloudflare 404), `/_headers` rules apply (`curl -I` shows CSP — docs/09
§4), and the old `softharbor.<subdomain>.workers.dev` no longer serves
(`workers_dev: false`). Full domain checklist: docs/16 §10.

### A4. Continuous deploys & previews

- Production: `deploy.yml` runs `cloudflare/wrangler-action` on every push
  to `main` (docs/12 §3).
- PR previews: `wrangler versions upload` produces a per-version preview
  URL (enabled by `"preview_urls": true`); the workflow comments it on the
  PR. Previews also run the legal gate — expected.
- Rollback: dashboard → the Worker → **Deployments** → promote a previous
  version, or `wrangler rollback`.

### A5. Observability & limits

- Metrics: Worker → **Metrics** shows request counts/status classes. There
  is no `wrangler tail` stream for pure static assets (no script runs) —
  client-side errors reach us via the bug-report flow instead (docs/05 §A5–A6).
- **Billing:** with no `main` script and `run_worker_first` unset, every
  request is served from static assets and is **not billed** — the site
  costs $0 in usage on the existing Workers Paid plan.
- Asset limits to respect (check current values in CF docs at setup time;
  documented limits as of writing): max ~20 000 files per deploy, 25 MiB
  per file. SoftHarbor's budget: < 1 000 files, largest file < 1 MiB —
  comfortable margins. `validate-data.mjs` warns at 15 000 files.

## Part B — What we deliberately do NOT configure in v1

The zone exists (Free plan) but stays minimal: **no rate-limiting rules,
no Bot Fight Mode, no Custom Errors** — each has a reason and a ready-made
activation recipe in **docs/16 §9** (short version: static assets are
unbilled so there's nothing to protect, bot challenges would break our own
`/api/apps.json` + RSS consumers, and Custom Errors is a paid-zone
feature). HSTS **is** configured — zone-level, phased (docs/16 §5). Do not
"pre-enable" anything beyond that.

## Part C — Error-page matrix (the definitive answer)

Background (re-verified 2026-07-20): Cloudflare **Custom Errors** is a
**paid zone-plan** feature — our zone is Free (docs/16 §1/N4) — and even
where available it does not apply to 500/501/503/505 responses. Therefore
in v1 **every error page a user can see must come from our own build
output**, and anything Cloudflare itself emits shows Cloudflare's default
page:

| Status | Who generates it in v1 | What the user sees | Our artifact |
|---|---|---|---|
| 404 | Static assets router (URL matches nothing) | Our branded page, real HTTP 404 | `dist/404.html` via `not_found_handling: "404-page"` |
| 500-class | Practically cannot originate from us (no script). Cloudflare infra errors (52x) show Cloudflare's page — not customizable on a Free zone | CF default (rare) | `/errors/500` template kept **dormant** |
| 403 | Nothing issues 403 in v1 — WAF features deliberately OFF (docs/16 §9). If ever enabled on the Free zone, blocks render **Cloudflare's default page** (custom responses are paid features) | n/a | `/errors/403` dormant template |
| 429 | Nothing issues 429 in v1 — rate limiting deliberately OFF (docs/16 §9); same Free-zone caveat as 403 | n/a | `/errors/429` dormant template |
| No internet | Client-side | Our offline page | `offline.html` via service worker (Part D) |

The dormant templates cost three static pages and make a future Pro-zone
Custom Errors switch-on a config-only task (docs/16 §9 recipe).

## Part D — PWA / offline ("No Internet" page)

Scope: **offline fallback only** — not an installable app-cache of the whole
site (a software directory is useless offline anyway; we just refuse to show
a browser dinosaur).

```ts
// astro.config.ts — AstroPWA(…)
AstroPWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'SoftHarbor', short_name: 'SoftHarbor',
    description: 'Free & buy-once desktop software, one page.',
    theme_color: '#f7f4ee', background_color: '#f7f4ee',
    icons: [/* 192, 512, maskable — public/icons/ */],
  },
  workbox: {
    // '_astro/*.woff2', NOT 'fonts/*.woff2' — Astro hashes fonts into _astro/,
    // so the old glob matched nothing and the offline page would have rendered
    // unstyled (found in M1, 2026-07-27).
    // 'offline.html', NOT 'offline/**' — the glob is coupled to build.format
    // ('file'), so the directory pattern matched nothing (M1/S5).
    globPatterns: ['offline.html', '_astro/*.woff2', 'favicon.svg'], // shell only
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
renders. **`pnpm check:sw` asserts this against the emitted `dist/sw.js`** —
no `NavigationRoute`, a `NetworkOnly` navigation handler, `/offline` and the
fonts actually precached, and `registerSW.js` referenced by a page. Every one
of the four service-worker bugs this project has had was silent at build time,
so the config being right is not evidence that the output is. Spike S5 verifies: SW registers under the production origin
(`softharbor.net` — a preview URL is acceptable for early iterations, but
the final pass runs on the real origin), fallback fires in airplane mode,
`autoUpdate` swaps SW without a stale lockout, and the legal gate behaves
on the offline page (it is exempt — docs/14 §2).

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
