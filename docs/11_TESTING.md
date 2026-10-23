# 11 — Testing Strategy

## 1. Shape

```
        ▲  manual: launch checklist (docs/13 §2) — screen readers, visual VI
        │          diacritics, real-device offline, production-only checks
        │  e2e (Playwright + axe): the BUILT site under `astro preview`,
        │          desktop Chrome + Pixel 7 — docs/11 §5
        │  build-as-integration-test: `pnpm build` and its gates —
        │          validate:data, i18n:check, check:csp, check:assets,
        │          check:sw, check:feed (docs/12 §2)
        │  Vitest, four projects: unit · islands · scripts · worker
        ▼
```

**Playwright is in, since v1.1 — this reverses v1's "No Playwright in v1"**
(decision log, docs/15 §4). The old reasoning — six islands, no forms,
build + units + a checklist cover it — did not survive contact with this
stack: the bugs that actually shipped were a script or style the CSP
silently refused, a dialog the platform could dismiss, an island that threw
on hydration, a page that overflowed a phone — every one with all unit
tests green. Only a real browser on the real build sees them.

**Vitest projects** (`vitest.config.ts`, all via `getViteConfig` so tests
resolve and compile exactly like the build):

| Project | Environment | Includes | Asserts |
|---|---|---|---|
| `unit` | node (a file may opt into happy-dom) | `src/{lib,i18n,styles,scripts}/**/*.test.ts`, `src/pages/**/_*.test.ts`, `src/*.test.ts` | pure logic, plus `contrast.test.ts` reading `global.css` (docs/06 §2); the Zod schema (`content.config.test.ts`) and the three data endpoints (`src/pages/_endpoints.test.ts` — the `_` keeps it out of routing) with `astro:content` stubbed; the verbatim head scripts re-imported per test in happy-dom (`src/scripts/head.test.ts`) |
| `islands` | happy-dom, `resolve.conditions: ['browser']` (else Svelte resolves to its SSR build and `mount()` throws) | `src/components/**/*.test.ts` | island *state machines* — open/close, keyboard interception, storage, fail-open paths — never layout or the top layer (that is e2e) |
| `scripts` | node | `scripts/**/*.test.ts` | the **real** build scripts, run as child processes inside throwaway project trees (`scripts/fixture.ts`), exit code and all |
| `worker` | node | `worker/**/*.test.ts` | `/api/verify` against a stubbed Siteverify — Node has every Web API it uses |

**Coverage** (`pnpm coverage`, V8) measures every analysed source since
2026-10-23: `src/lib/**`, `src/i18n/**`, `src/scripts/*.js`, the endpoints
in `src/pages/**/*.ts`, `src/content.config.ts`, the island `.svelte` files,
`worker/**` **and the build scripts** — they run as child processes, and
`coverage.autoAttachSubprocess` (Vitest 5) hands each child
`NODE_V8_COVERAGE`, so their real runs count. Never also import a script
in-process: Vitest merges the two kinds of coverage for one file wrongly.
Thresholds are a **ratchet**: statements 96 · branches 85 · functions 95 ·
lines 97, just under the measured 96.7 / 85.6 / 95.5 / 97.6 (2026-10-23;
they were 93/78/90/93 over the narrower scope). Raise them when coverage
rises; never lower them to land a change. CI runs `pnpm coverage` as *the*
unit step, so a drop fails the PR, and the `sonar` job sends the same
`coverage/lcov.info` to SonarQube Cloud (docs/12 §2), which indexes no
`.svelte`/`.astro` file — the islands' entries are reported unresolved — and
excludes only the root `*.config.*` files.

## 2. Unit targets (`vitest`)

| Module | Cases |
|---|---|
| `normalize.ts` | full vector table docs/05 §A1 incl. NFC vs NFD inputs, `đ/Đ`, whitespace collapse, empty string |
| `search.ts` / `searchIndex.ts` | index round-trip (`toJSON`/`loadJSON`); `trinh duyet` → browsers; prefix (`fire` → Firefox); fuzzy (see note); AND semantics; empty query behavior; `tags` array flattened by `extractField`; one download per page; a failed load reported and retried |
| `stores.ts` + `filter.ts` + `grid.ts` | OR-within/AND-across facets, empty facet = no constraint; sort orders incl. VN names, locale-independent collation, relevance rank; DOM reorder by node moves and never an inline style (checked to fail against the old `style.order` version); cleared query drops cached hits; plural count templates. "Clear all" end to end: e2e |
| `urlstate.ts` | parse/serialize round-trip; junk facet values and unknown sorts dropped; stable key order; default view → empty string |
| `issueUrl.ts` / `ringbuffer.ts` | budget respected; truncation drops oldest lines first; empty buffer; URL-encoding of `#`/`&`/newlines; reader tolerates a missing buffer |
| `feed.ts` | deterministic output; top-50 cutoff; stable guid; export sorted by slug |
| `i18n/index.ts` | var substitution; an unreplaced placeholder stays visible; parity assertion (en/vi key sets equal — the same check CI runs), no empty value, VI actually translated; locale routing — `canonicalPath()` strips `.html`, `localePair()` symmetric |
| `legal.ts` | version equality (stale **and** newer both re-open); garbage value; hostile localStorage fails open per session; **every accepted document's `LEGAL_UPDATED` ≤ `LEGAL_VERSION`**; every date real and past. (Route exemptions left this module — pages declare `gateExempt`; e2e covers them.) |
| `human.ts` / `turnstile.ts` | 48 h / 1 h lifetimes; far-future and garbage values refused; memory fallback; `api.js` injected once; timeouts, 403 → fresh challenge (max 3), every other failure → *unverified*, never a throw |
| `theme.ts` / `prefs.ts` / `lang.ts` | defaults on garbage; system/auto stored as "no key"; **`prefs.test.ts` runs the real `src/scripts/theme.js`** so pre-paint and island rules cannot drift |
| `licenses.ts` / `logo.ts` / `paths.ts` | generated package table (installed versions, legacy and missing licenses); logo forms incl. monogram, no `style` attribute, escaped initials; category-page order (`byAddedDesc`) |
| `contrast.test.ts` | WCAG ratios for every token pair, both themes; no-JS dark block identical to the dark theme (docs/06 §2) |
| `scripts/*` (scripts project) | `validate-data` (each rule → its error row), `check-csp`, `check-i18n-parity`, `check-service-worker`, `check-feed`, `quarantine` — real script, temp tree, exit code |
| `worker/*` (worker project) | method, origin, media type, size (declared and streamed), token shape, rate limit, Siteverify verdicts (host, action, age, test secrets), retry with the same idempotency key, 503 without a secret, security headers on every response |
| islands | one test file per island (`Sh*.test.ts`): gate steps and Esc handling, search races and URL writes, filter sheet counts, language switch carrying the query, display menu storage, bug-report URL |

**Fuzzy vectors — resolved by S2 (2026-07-27), decision D22.** The old
`gmip` → GIMP case is a *transposition* (2 edits on 4 characters) and needs
`fuzzy ≥ 0.375`; measurement showed that setting also stops the correctly
spelled `gimp` from being an exact match (table in docs/05 §A2). It was
**retired** in favour of `fuzzy = 0.25` plus honest vectors: `gimo` → GIMP
(1 edit) and `fierfox` → Firefox (transposition in a 7-char term). The suite
also pins the *precision* side — `gimp` → only GIMP, `archiver` → only 7-Zip
— so a future fuzzy miss cannot be "fixed" by raising the constant.

Coverage gates: the global ratchet in §1 (statements 96 · branches 85 ·
functions 95 · lines 97) over everything listed there. `.astro` files carry no coverage gate — their rendered output is
checked by the build gates and the e2e suite.

## 3. P0 spikes — run before feature work (phase P1)

> Pattern carried from FrameLedger/QuoteAtlas: prove the risky assumptions
> on day one, while changing course is still free.

### S1 — Toolchain reality check (Astro 7 + Rolldown)
- **Goal:** the *entire* integration set compiles and dev-serves together:
  `@astrojs/svelte` (Svelte 5), `@tailwindcss/vite` 4.3, `unplugin-icons`,
  `@vite-pwa/astro`, `@astrojs/sitemap`, `@astrojs/rss`, Vitest.
- **Method:** scaffold, add all, build a page using each (an icon, a styled
  Svelte island, PWA manifest emit, one rss/sitemap route), `pnpm build`,
  `pnpm test` on a trivial spec. Also settle the dependency build-script
  policy (docs/09 §7).
- **Exit:** clean build + dev HMR + SW emitted.
- **Fallback (pre-approved):** pin `astro@6.5.x`; record in decision log.

**S1 result — PASSED 2026-07-27.** Astro 7.1.3 · Svelte 5.56.8 · Tailwind
4.3.3 · MiniSearch 7.2.0 · nanostores 1.4.1 · Vitest 4.1.10 all build and
type-check together; the Astro 6.5 fallback was **not** needed. Four findings
changed the spec:

1. `@nanostores/svelte` does not exist (D15 amended, docs/01 §2).
2. Island hydration emits inline scripts ⇒ D18 unachievable, replaced by the
   split CSP of D20 (docs/09 §4). ClientRouter itself is external, so View
   Transitions are safe.
3. TypeScript 7 breaks `astro check` ⇒ hold at 6.x (D21; since 2026-10-23
   TS 6 and TS 7 run side by side — docs/01 §2).
4. `ignore-scripts=true` does **not** "break nothing" — it stops the build
   outright, and pnpm ≥ 10 supersedes it anyway (docs/09 §7).

Still open in S1, and it needs a deploy (H2/H3), not code: the
`trailingSlash: 'never'` × `html_handling` check. Run the two `curl` probes in
docs/16 §10 the moment the first deploy lands.

**S1 additionally owns two questions this suite could not settle on paper.
Neither is optional — both change shipped behavior:**

1. **Does `script-src 'self'` survive `<ClientRouter />`?** (docs/09 §4, D18.)
   Serve the built `dist/` with the real `_headers` CSP and navigate. If
   ClientRouter emits an inline bootstrap, the console shows a CSP violation.
   *Exit:* zero CSP violations with zero inline scripts.
   *If it fails:* drop `<ClientRouter />` — and with it View Transitions
   (docs/02 §6, docs/06 §7). Log the branch taken. Do **not** resolve this by
   adding hashes back without re-reading docs/09 §4.
   *(Answered by D20 in P1. ClientRouter itself was later dropped anyway —
   2026-10-21, for native cross-document transitions — because its soft
   navigation kept the first page's meta CSP; docs/02 §6.)*
2. **`trailingSlash: 'never'` × Workers `html_handling`.** (docs/02 §4/§7.)
   Deploy and `curl -sI` **both** `/apps/7-zip` and `/apps/7-zip/`.
   *Exit:* exactly one canonical URL returns 200 and the other 301s to it —
   no redirect loop, no two live URLs for one page. Pin whichever
   `html_handling` value produces that into `wrangler.jsonc`.

### S2 — Vietnamese search correctness
- **Goal:** normalizer + MiniSearch behave on real Vietnamese.
- **Method:** run the §2 vector table; add paste-input cases in **both** NFC
  and NFD encodings (generate with `String.normalize`), plus mixed-language
  queries against a 20-app fixture set.
- **Exit:** all green; `trinh duyet`, `trình duyệt`, `TRINH DUYET`,
  decomposed `trình duyệt` return identical result sets.

### S3 — GitHub Issue-Forms prefill limit
- **Goal:** find the real max URL length github.com accepts with form-field
  prefill, and confirm params map to field ids.
- **Method:** hand-craft URLs against a scratch repo's `bug_report.yml`,
  binary-search length until GitHub truncates/rejects; test `\n` and unicode
  in `console-output`.
- **Exit:** empirical limit documented; `BUDGET` in `issueUrl.ts` set to
  ~80 % of it; prefill lands in the correct fields.

**S3 result — PARTIAL, 2026-07-27.** The length ceiling is measured and
`BUDGET` is set (table + reasoning in docs/05 §A6): clean to 6 660, a **500
band from ~7 160 to ~7 960**, then 414 from ~8 360. Because GitHub 500s rather
than degrading into 414, `BUDGET = 5000` sits ~25 % below the first failure
instead of the 80 %-of-hard-limit this doc originally specified — 80 % of the
414 boundary lands *inside* the 500 band.

`bug_report.yml` **is now on `main`** and GitHub serves it, so the prefill
path is live. **One manual step remains** — confirming the params land in the
right fields needs a signed-in browser, which is not something automation
should do on the maintainer's behalf. Open this and check that *Page URL*,
*Browser & OS* and *Console output* are pre-populated:

```
https://github.com/poli0981/softharbor/issues/new?template=bug_report.yml&labels=bug&page-url=https%3A%2F%2Fsoftharbor.net%2Fapps&environment=test&console-output=probe
```

If a field is empty, its `id` in `bug_report.yml` no longer matches the query
param in `issueUrl.ts` — that pairing is the contract (docs/12 §7).

### S4 — Legal gate × View Transitions
- **Goal:** gate never re-flashes across ClientRouter navigations and truly
  blocks interaction pre-accept.
- **Method:** prototype `ShLegalGate` with `transition:persist`; navigate
  grid → detail → back pre-accept and post-accept; verify focus trap, Esc
  interception, exempt routes, `sh:legal` versioning incl. downgrade value.
- **Exit:** zero flash, zero interaction leaks, exemptions correct.

**S4 result — PASSED 2026-07-27, with two design bugs caught.** The gate is
`ShLegalGate.svelte` (`client:load` + `transition:persist`); 32 automated
assertions cover it (`legal.test.ts` + `ShLegalGate.test.ts`).

1. **A persisted `<dialog>` can come out of a document swap with `open`
   cleared.** `transition:persist` preserves the DOM node, not the top-layer
   state — so the gate would have silently stopped blocking after the first
   navigation. Fixed by re-asserting `showModal()` in an `astro:after-swap`
   handler; the test closes the dialog behind the component's back and swaps,
   to prove the re-assert is load-bearing.
2. **A persisted island keeps the `locale` prop it first rendered with.**
   Navigating `/apps` → `/vi/apps` left English gate copy on a Vietnamese
   page. Fixed by deriving locale from `location.pathname` on every swap
   rather than trusting the prop.

Also verified: Esc intercepted pre-accept (`cancel` prevented); acceptance
persists and never re-flashes across swaps; exempt routes never gate, and
navigation *onto* and *off* an exempt route updates correctly; a stale **or
newer** stored version re-opens (equality, not ordering); hostile localStorage
fails open for the session instead of dead-locking.

**Not covered by the automated pass** — these stay manual launch-checklist
items (docs/13 §2), because the environment has no browser: real top-layer
stacking/backdrop, actual focus trapping by the UA, and "no visual flash".
The tests assert the *state machine* that drives those, not their rendering.

**S4 superseded, 2026-10-21.** `<ClientRouter />` is gone (docs/02 §6), so
there is no swap to survive: the gate mounts on every non-exempt page, with
no `transition:persist` and no `astro:after-swap` re-assert, and it carries
only its own page's strings. Both design bugs above are therefore gone by
construction. Exemptions moved from a path regex to a page-declared
`gateExempt`. The browser-only gaps listed above are now covered by
Playwright (`e2e/gate.spec.ts`, §5): real top layer, Esc pressed twice
against Chromium's close-watcher, `closedby="none"`, persistence across a
reload, exempt pages. Screen-reader and visual checks stay manual.

### S5 — PWA offline on the real origin
- **Goal:** offline fallback works where users are: `softharbor.net`.
- **Method:** deploy the spike build (a versioned preview URL is fine for
  early iterations; the final pass runs on `softharbor.net` once H2's zone
  is live — docs/08 Part D); airplane-mode navigation on desktop + Android
  Chrome; verify `/offline` renders, fonts present, SW `autoUpdate` picks
  up a redeploy without hard refresh.
- **Exit:** fallback fires on both devices on the production origin;
  update flow clean.

**S5 result — software PASSED on a real origin, 2026-07-27** (Cloudflare
preview URL; the Worker was created with a routes-free config so nothing is
attached to `softharbor.net` yet). Four bugs found, all of which would have
shipped:

1. **The service worker never registered.** `@vite-pwa/astro` emits
   `registerSW.js` and `sw.js` but references them from no page, and the build
   reports success either way — the entire offline story silently did not
   exist. `Base.astro` now loads the emitted file.
2. **`navigateFallback` served the offline page to ONLINE visitors.** Alone it
   registers a NavigationRoute answering *every* navigation from the precache;
   an online request for `/apps` returned "You appear to be offline". Part D's
   original `NetworkOnly` + `precacheFallback` shape is correct and had been
   dropped from the config.
3. **`clientsClaim` was false**, so the SW controlled only pages loaded after
   activation — a first-time visitor losing connection mid-session got the
   browser's error page.
4. The workbox globs are **coupled to `build.format`** (`offline.html`, not
   `offline/**`), and Workbox normalises the precache key to the extensionless
   `/offline`. Both verified against the emitted manifest rather than assumed.

Verified: `_headers` applies on Workers Static Assets, `/nope` → real 404,
SW active **and controlling**, `/offline` precached with all 13 fonts and
rendering both languages, online navigation still serving real pages.

**Re-verified on `https://softharbor.net` itself** after the apex deploy
(2026-07-27): SW active **and controlling**, 15 precache entries incl. all 13
fonts, `/offline` cache-servable, online navigation still serving real pages,
zero console errors.

**Still outstanding:** the actual airplane-mode pass on desktop **and Android
Chrome**, which is a device test. The software wiring above is what can be
verified without one.

## 4. Continuous wiring

CI (`ci.yml`, docs/12 §2), every PR and push to `main` — failure anywhere
blocks merge:

- **`build` job:** install (frozen) → `pnpm lint` → `pnpm check` →
  `pnpm coverage` (the unit run, thresholds enforced) → `pnpm build`
  (validate:data → i18n:check → astro build → postbuild:html → check:csp →
  check:assets → check:sw → check:feed; 701 pages) → `wrangler deploy
  --dry-run` (bundles `worker/`, validates `wrangler.jsonc`) → `pnpm knip` →
  Playwright e2e on that build (Chromium cached per Playwright version; the
  HTML report uploaded as an artifact on failure).
- **`gates` job:** validate:data, i18n:check, osv-scanner, `pnpm audit
  --prod`, and on PRs a lychee sweep of the official links the PR changed.

CodeQL also runs per PR (its check is required). The weekly full link
sweep runs on schedule (docs/12 §5). There is no lychee pass over `dist/`
internal links; `check:assets` verifies every same-origin asset a page
references, and page-to-page links are covered by the e2e page set.

## 5. End-to-end (Playwright + axe)

`playwright.config.ts`, specs in `e2e/`. Runs against the **built** site
served by `astro preview` on `127.0.0.1:4321` — the per-page meta CSP is
exactly as shipped (`ASTRO_PREVIEW_BACKGROUND=0` keeps the server in the
foreground; Astro ≥ 7.2 backgrounds it under CI). Two projects: `desktop`
(Desktop Chrome) and `mobile` (Pixel 7 — bottom sheets, the wrapped header,
touch targets). CI: one retry, traces kept on failure, report artifact.

**Shared fixture** (`e2e/fixtures.ts`, auto-applied): a test **fails** if
its page logged a console error, threw an uncaught exception, or fired a
`securitypolicyviolation` (collected by an init script — the meta policy
cannot report anywhere else). Messages from inside Cloudflare's Turnstile
iframe are ignored (its own CSP probes, docs/09 §4); a test may whitelist an
expected line (Chrome's "status of 404" on the 404 test). Helpers:
`acceptGate()` pre-seeds `sh:legal` and `sh:human` for tests about
something else; `stubTurnstile()` serves a fake `api.js` **from its real
URL** (so the page CSP is still exercised) and answers `/api/verify` — which
`astro preview` does not run — with 200, 503, or blocks the script;
`waitForIsland()` waits for hydration; `settled()` waits for entrance
animations before axe measures contrast.

| Spec | Covers |
|---|---|
| `smoke.spec.ts` | 15 pages in both locales (home, grid, detail, categories, legal, offline, contact): status < 400, an `h1`, a resolved `data-theme`, **no horizontal overflow**; an unknown URL → real 404 without the gate; **axe** (WCAG 2.0/2.1 A+AA, 2.2 AA tags) on five pages in **light and dark**, serious/critical findings fail |
| `gate.spec.ts` | blocks a first visit until accepted *and* checked; Esc twice cannot dismiss; **no Cloudflare request before acceptance**; check remembered ~48 h across a reload; blocked script or 503 → visitor let through with the "skipped" note and a 1 h retry; a lapsed check re-runs step 2 only; linked documents and error/offline pages are exempt |
| `prefs-search.spec.ts` | display choices apply at once and are restored pre-paint on the next document; `/` from any page lands focused in `/apps#search`; Vietnamese search ignores diacritics, writes `?q=` and switches to "Best match"; a shared URL restores the view and "Clear all" really clears it |

**Not covered here, by design:** `_headers` and the Worker — `astro
preview` applies neither. They are verified on the Workers Builds preview
URL and in production after each merge (docs/13 §3).
