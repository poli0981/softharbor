# 15 — Roadmap & Decision Log

## 1. Milestones (solo-dev estimates, focused days)

| M | Scope (docs) | Exit criteria | Est. |
|---|---|---|---|
| **M0 — Spikes** | S1–S5 (11 §3) | all pass or fallbacks recorded | 2–3 d |
| **M1 — Skeleton** | scaffold, tokens, fonts, layout, Base.astro, dark mode (02, 06) | Welcome + empty grid deployed manually (preview URL, or `softharbor.net` once H2's zone is live) | 2 d |
| **M2 — Data layer** | schema, registry, validate-data, 5 seed apps, detail pages (03, 04) | build fails on bad fixture; 5 real entries render EN+VI | 2 d |
| **M3 — Find things** | search index route, ShSearch, ShFilterSheet, sort, nanostores (05) | S2 vectors pass in-app; filters compose; no-JS grid intact | 3 d |
| **M4 — Trust layer** | legal gate, legal pages ×2 locales, security lines, ShLangSwitch, ShThemeToggle (07, 14) | gate passes S4 checks; parity CI green | 3 d |
| **M5 — Resilience & pipes** | 404/offline/PWA, dormant errors, /api/apps.json, rss, bug-report button, _headers (08, 09) | launch-checklist infra section fully green | 2–3 d |
| **M6 — Ship** | CI/CD wiring, branch protection, 30 seed apps, checklist, v1.0.0 (12, 13) | public announcement sent | 3–4 d |

Total ≈ 17–20 focused days, **plus ~1 day for the `softharbor.net` domain
package** (docs/16 §10) slotted between M5 and M6. Data entry (M6)
parallelizes with earlier milestones once M2 lands.

## 2. Post-v1 backlog (ordered by current intent)

1. **Zone upgrades on evidence, not by default** — revisit the
   deliberately-OFF trio (rate limiting, Bot Fight Mode, Pro-zone Custom
   Errors) only if abuse or 403/429 UX ever becomes real (docs/16 §9);
   plus the `?q=` search deep-link that would unlock a `SearchAction`
   JSON-LD node (docs/16 §7).
2. **VirusTotal automation** — scheduled workflow scanning `links.download`
   via VT API, writing `evidence` + opening flag issues on detections
   (turns docs/09 §6.5 from manual to assisted).
3. **Install-command snippets** — optional `install.winget` /
   `install.brew` fields rendered as copy buttons.
4. **Favorites** — localStorage star + "my list" view (stays static).
5. **OG images** — per-app social cards generated at build.
6. **JP locale (v1.2)** — third dictionary + `summary.ja`; follows the
   EN/VI/JP baseline of PhantomMAC/IconForge.
7. **Community data automation** — app_request issues auto-drafting data
   PRs for maintainer review.
8. Playwright smoke pack if island count grows past six.
9. **Grid pagination — triggered by size, not by date.** `/apps` server-renders
   every card and filters by toggling `hidden` (docs/05 §A3), which is what
   keeps the no-JS experience whole. That trade stops paying somewhere around
   **~250 entries**: at ~600 bytes of HTML per card, 250 cards ≈ 150 KB and
   1 000 cards ≈ 600 KB, against an LCP target of < 1.5 s on mid-range mobile
   (docs/00 §2.5). **Trigger:** when the dataset passes 250 apps, or `/apps`
   HTML passes 200 KB gzip, paginate or virtualize — and keep a full
   unpaginated listing reachable for no-JS users. Revisit before the count
   gets there, not after.

## 3. Explicitly rejected (for the record)

Ratings/reviews (scope creep, moderation burden) · hosting binaries
(liability, cost) · auto-scraped metadata (provenance & license risk — hard
rule 8) · ads/affiliate links (conflicts with the trust proposition).

## 4. Decision log

> Append-only. "⚠ review" = self-resolved by the doc suite, awaiting
> Kokone's explicit sign-off.

| Date | Decision | Status |
|---|---|---|
| 2026-07-15 | Name **SoftHarbor**; repo `poli0981/softharbor` | ✅ Kokone |
| 2026-07-15 | Data license **CC BY-SA 4.0** (`LICENSE-DATA.md`) | ✅ Kokone |
| 2026-07-15 | **No custom domain in v1**; workers.dev; dormant 403/429/500 templates | ⛔ superseded 2026-07-20 (domain purchased — see rows below) |
| 2026-07-15 | Astro 7 + Svelte 5 + Tailwind 4.3 + Node 24 LTS + pnpm 10 (fallback: pin Astro 6.5.x if S1 fails) | ✅ from spec session |
| 2026-07-15 | Security model `status/evidence/checkedAt`; quarantine-not-delete | ✅ from spec session |
| 2026-07-15 | `en` default **unprefixed**, `vi` at `/vi/`, **no auto-redirect**, one-time suggestion banner | ⚠ review (D13) |
| 2026-07-15 | C3 ruling: free tiers of subscription products listable as `free` when self-sufficient | ⚠ review |
| 2026-07-15 | Fonts: **Bricolage Grotesque** chosen over Space Grotesk for display | ⚠ review (D9) |
| 2026-07-15 | Added **nanostores** as the one cross-island state dep | ⚠ review (D15) |
| 2026-07-15 | Legal drafts embedded in docs/14; split into `/legal/*` pages at implementation | ⚠ review |
| 2026-07-15 | No analytics in v1 | ✅ from spec session |
| 2026-07-15 | Category taxonomy fixed at 12 ids (docs/04 §4) | ⚠ review |
| 2026-07-20 | **`softharbor.net` purchased**; docs suite → v1.1; new docs/16 owns domain/SEO ops | ✅ Kokone |
| 2026-07-20 | Canonical = apex `https://softharbor.net`; `www` 301 via zone Redirect Rule; **no auto-anything else** | ⚠ review (N1–N2) |
| 2026-07-20 | `workers_dev: false` + explicit `preview_urls: true` — previews stay, main workers.dev route dies | ✅ (platform-verified) |
| 2026-07-20 | Zone plan **Free**; Custom Errors therefore unavailable; `/errors/*` stay dormant | ✅ (plan-gating re-verified) |
| 2026-07-20 | Rate limiting + Bot Fight Mode deliberately OFF at launch (recipes in docs/16 §9) | ⚠ review (N6) |
| 2026-07-20 | HSTS zone-level, phased P1→P2→optional P3 preload (H9 = Kokone's call) | ⚠ review (N5) |
| 2026-07-20 | Contact = `contact@softharbor.net` via Email Routing; SPF + DMARC quarantine→reject | ⚠ review (N7) |
| 2026-07-20 | SEO additions: GSC Domain property, Bing import, Crawler Hints/IndexNow ON, JSON-LD `SoftwareApplication` + `BreadcrumbList` (price only for `free`) | ⚠ review (N8) |
| 2026-07-27 | **Suite audit → v1.2.** Six build/deploy blockers fixed before any code was written (below) | ✅ |
| 2026-07-27 | CI called `reusable-node-ci.yml` and `reusable-notify.yml` — **neither exists** in `poli0981/.github`. Rewired to `reusable-web-react.yml` (generic Node, accepts pnpm) + a local `gates` job, and `announce-release.yml` (Discord-only) | ✅ (verified via `gh`) |
| 2026-07-27 | **D16** `developer` required in schema + rendered (docs/04 §2 documented a field the `.strict()` schema rejected) | ⚠ review |
| 2026-07-27 | **D18** CSP: zero inline scripts, `script-src 'self'`, no hash pipeline; theme → `public/theme.js` | ⚠ review — **S1 must confirm ClientRouter survives** |
| 2026-07-27 | Card markup: wrapping `<a>` with nested chip links replaced by the stretched-link pattern (nested anchors are invalid HTML) | ✅ |
| 2026-07-27 | VI glossary moved out of `vi.json` into docs/07 §9 — a `_glossary` key would fail the strict parity check it was meant to serve | ✅ |
| 2026-07-27 | Search index stores **raw** fields; `processTerm` normalizes both sides. No `*Norm` copies, no `storeFields` | ✅ |
| 2026-07-27 | `fuzzy: 0.15` marked provisional — the declared `gmip → GIMP` vector needs ~2 edits and cannot pass. **S2 owns the final value** | ⚠ open |
| 2026-07-27 | **D17** pnpm 10 kept despite npm siblings | ✅ |
| 2026-07-27 | Toolchain majors corrected against `poli0981-dev`: TypeScript 6, ESLint 10, lefthook 2, knip 6 | ✅ (verified) |
| 2026-07-27 | Action pins bumped to `checkout@v7` / `setup-node@v6` / `pnpm/action-setup@v6`; SHA-pinning rule scoped to repo-local workflows | ✅ |
| 2026-07-27 | `wrangler` `html_handling` made explicit; `sitemap({ filter })` excludes `/offline` + `/errors/*`; `_astro/*` and HTML cache rules added | ✅ |
| 2026-07-27 | Export contract `$schema` → `schemaVersion: 1` (integer) before it ships and freezes | ✅ |
| 2026-07-27 | New **H10**: enable "Allow GitHub Actions to create and approve pull requests" — the quarantine sweep cannot open its PR without it | ⚠ Kokone |
| 2026-07-27 | **P1/M0 executed.** Scaffold builds; S1 and S2 passed; findings below | ✅ |
| 2026-07-27 | **B7 / D15 amended** — `@nanostores/svelte` **does not exist** (registry 404). Not needed: nanostores atoms satisfy Svelte's store contract natively | ✅ (verified) |
| 2026-07-27 | **D20 supersedes D18** — Astro island hydration emits inline scripts, so "nothing inline" is unachievable. CSP split: Astro `security.csp` meta owns script-src/style-src with generated hashes; `_headers` owns only `frame-ancestors` | ✅ (S1, hashes re-verified) |
| 2026-07-27 | ClientRouter is an **external** script — View Transitions survive. The M1 fallback risk is closed | ✅ (S1) |
| 2026-07-27 | **D21** hold TypeScript at 6.x — TS 7's native compiler breaks `astro check` | ✅ (S1, reproduced) |
| 2026-07-27 | **D22** `FUZZY = 0.25`; `gmip → GIMP` vector retired as not worth its false positives | ✅ (S2, measured) |
| 2026-07-27 | `ignore-scripts=true` removed — pnpm ≥ 10 blocks dep scripts by default; the flag also suppresses the `allowBuilds` allowlist and stops the build entirely. pnpm line corrected 10.x → 11.x | ✅ (S1) |
| 2026-07-27 | Prettier ignores `docs/` + `CLAUDE.md` — the suite is hand-wrapped, and reformatting would bury every future docs diff | ✅ |
| 2026-07-27 | **S4 passed**, catching two design bugs: a `transition:persist`ed `<dialog>` loses top-layer state across a swap (fixed by re-asserting `showModal()` on `astro:after-swap`), and a persisted island keeps its first `locale` prop, so EN copy leaked onto `/vi/` pages (fixed by deriving locale from the path) | ✅ |
| 2026-07-27 | Island tests added in **happy-dom** (`vitest.config.ts`, two projects). Does **not** reopen the no-Playwright decision — asserts island state machines only; layout/top-layer/visual stay manual (docs/11 §1) | ⚠ review |
| 2026-07-27 | Legal-gate session fallback moved from a module-local `let` to a `globalThis` key — its scope really is the session, and a module-local silently leaked acceptance between tests | ✅ |
| 2026-07-27 | **M1 skeleton done** — tokens, self-hosted fonts, Base/header/footer, Welcome + empty grid in **both** locales, i18n helper + parity gate | ✅ |
| 2026-07-27 | `_headers` had a dead `/fonts/*` rule and the PWA a dead `fonts/*.woff2` glob: Astro hashes fonts into `/_astro/`, so the offline shell would have shipped **unstyled**. Both corrected (docs/08 D, docs/09 §4) | ✅ (found by inspecting `dist/`) |
| 2026-07-27 | Page bodies live in `src/components/pages/*.astro`; `src/pages/**` are thin locale wrappers. Implements the docs/07 §2 no-duplication rule for whole pages, not just `getStaticPaths` | ✅ |
| 2026-07-27 | i18n parity script also enforces **alphabetical key order** — a 200-key dictionary is unreviewable otherwise | ✅ |
| 2026-07-27 | **S1 closed on a real deploy**: `build.format: 'file'` + `html_handling: 'drop-trailing-slash'`. The default pairing 307'd every canonical URL we advertise | ✅ (measured) |
| 2026-07-27 | **S5 software passed**, 4 bugs: SW never registered (`@vite-pwa/astro` emits but never references `registerSW.js`); `navigateFallback` served the offline page to *online* visitors; `clientsClaim` false; workbox globs coupled to `build.format`. Device airplane-mode pass still outstanding | ✅ / ⚠ |
| 2026-07-27 | **S3 partial**: `BUDGET = 5000`. GitHub 500s between ~7 160 and ~7 960 rather than degrading to 414, so 80 %-of-hard-limit would have landed inside the 500 band. Field-mapping check still needs the template on `main` | ✅ / ⚠ |
| 2026-07-27 | Pre-launch `X-Robots-Tag: noindex` in `_headers` while the dataset is empty; removal is a launch-checklist item (docs/13 §2) | ✅ |
| 2026-07-27 | **`softharbor.net` is LIVE** — apex deployed, DNS + cert provisioned by `wrangler deploy`, M1 skeleton serving. **M0 and M1 complete** | ✅ |
| 2026-07-27 | S5 re-verified on the production origin (SW controlling, 15 precache entries, no console errors). Airplane-mode device pass still outstanding | ✅ / ⚠ |
| 2026-07-27 | `main` fast-forwarded to the feature branch so `bug_report.yml` reaches the default branch — GitHub reads issue templates only from there | ✅ |
| 2026-07-28 | **M2 complete** — Zod schema (L1), `validate-data.mjs` (L2), `extract-urls.mjs` (L3), 12-category registry, 5 seed apps, card/grid/detail/category pages in both locales. 43 pages, deployed | ✅ |
| 2026-07-28 | **The T4 `set:html` ban had never worked** — the hand-rolled selector targeted `JSXAttribute`, which astro-eslint-parser does not emit for template directives. Replaced with `astro/no-set-html-directive` and negative-controlled | ✅ |
| 2026-07-28 | `unplugin-icons` is static-import-only and cannot resolve a data-driven `logo`. `src/lib/icon.ts` inlines from the same vendored Iconify JSON at build time; the T4 ban carries one carve-out scoped to three named files | ⚠ review |
| 2026-07-28 | Seed entries enter as `security.status: "unverified"` — `clean` requires the docs/09 §6 checklist, and hard rule 4 forbids clean-by-default. Licenses/developers still need the L4 pass | ⚠ Kokone |
| 2026-07-28 | Post-deploy edge propagation makes brand-new routes 404 intermittently for a minute or two; documented in docs/16 §10 so it is not mistaken for a config bug | ✅ |
| 2026-07-28 | **M3 complete** — `/search-index.json`, nanostores, pure filter/sort in `src/lib/filter.ts`, `ShSearch` + `ShFilterSheet`. S2 vectors verified **in-app**; facets compose; no-JS grid intact | ✅ |
| 2026-07-28 | **nanostores' `$name` convention is incompatible with Svelte** — `$` is reserved for auto-subscription, so atoms are exported unprefixed and referenced as `$name` in components (docs/05 §A3) | ✅ |
| 2026-07-28 | Grid controller lives in `src/lib/grid.ts`, not a 7th island — docs/02 §5 caps islands at six. Reordering uses CSS `order`, never DOM moves | ✅ |
| 2026-07-28 | All 5 seed entries share `addedAt`, so the "Newest" sort currently falls through to the name tiebreak. Correct, but it means sort order is only exercised by unit tests until entries land on different days | ⚠ note |
| 2026-07-28 | **M4 complete** — legal gate copy moved into the dictionaries, 5 legal documents ×2 locales, `ShLangSwitch` + `ShThemeToggle`, `LICENSE-DATA.md`. Five of six islands now exist (`ShBugReport` is M5) | ✅ |
| 2026-07-28 | **Regression caught in M4, introduced by the S1 trailing-slash fix**: `build.format: 'file'` makes `Astro.url.pathname` the emitted FILE name, so all 52 pages shipped `.html` canonicals and hreflangs that disagreed with the sitemap. Fixed via `canonicalPath()` (docs/07 §6) and pinned by tests | ✅ |
| 2026-07-28 | Gate strings are passed to the island as props rather than importing `t` — the gate must switch locale without a reload, but importing the dictionaries would bundle all 78 keys into it | ✅ |
| 2026-07-28 | Locale ROUTING split into `src/lib/locale.ts` (no dictionary import) so islands can use `localePair` without pulling in every string | ✅ |
| 2026-07-28 | Legal drafts are published as written in docs/14. **H6 (Kokone's review) is still outstanding**, and `LEGAL_VERSION` should be reset to the approval date when it happens — bumping it re-opens the gate for everyone, which is the intended behaviour | ⚠ Kokone |
| 2026-07-28 | **M5 complete** — `/api/apps.json`, `/rss.xml`, `ShBugReport` (the 6th and final island), dormant `/errors/*`, 404/offline, `security.txt`, `SECURITY.md`, JSON-LD, favicon. **All six islands now exist**; a seventh needs a decision-log entry | ✅ |
| 2026-07-28 | Feed determinism **verified by building twice and comparing hashes** — `/rss.xml` byte-identical, so notify.py cannot double-fire. `@astrojs/rss` has no `guid` option, so the slug guid is injected via `customData` (docs/05 §A4) | ✅ |
| 2026-07-28 | Ring-buffer listeners moved OUT of `ShBugReport` into `public/errors.js`: the island is `client:visible` in the footer, so hydration-time listeners would have missed every error before the user scrolled (docs/05 §A5) | ✅ |
| 2026-07-28 | `public/*.js` is now linted with browser globals rather than ignored — `theme.js` had been exempt | ✅ |
| 2026-07-28 | **PNG PWA icons (192/512/maskable) still missing.** ⛔ superseded — Kokone chose to ship the existing SVG: manifest now uses `favicon.svg`, `sizes: "any"`, `purpose: "any maskable"`. Raster PNGs remain an optional upgrade | ✅ |
| 2026-07-28 | **M6 complete** — CI/CD workflows, `quarantine.mjs`, renovate, CODEOWNERS, issue templates. Infra section of the launch checklist verified green against production | ✅ |
| 2026-07-28 | **H6 approved.** `LEGAL_VERSION` set to 2026-07-28; everyone who accepted the pre-approval wording sees the gate once more, as intended | ✅ Kokone |
| 2026-07-28 | **`X-Robots-Tag: noindex` removed.** It guarded against indexing an EMPTY site; with real entries, legal pages and a sitemap live that objection no longer holds | ✅ |
| 2026-07-28 | **`www` was being deleted by `wrangler deploy`** — a hand-added DNS record is not in the Worker's trigger list, so deploys reconciled it away and the redirect died silently. Fixed by declaring `www.softharbor.net` as a second `custom_domain` so wrangler owns the record. **Redirect Rule R1 is now a hard prerequisite**: without it www would serve a duplicate of the site | ✅ (verified across a deploy) |
| 2026-07-28 | Quarantine sweep tested end-to-end: a flagged entry vanishes from the detail page, grid, API export, RSS feed **and** search index — all five surfaces | ✅ |
| 2026-07-28 | Dead-code sweep: `ShProbe.svelte` (a dead S1 leftover sitting in `islands/`, where docs/02 §5 caps the count at six), 5 unused exports, 2 `exactOptionalPropertyTypes` violations. `knip` now passes clean so the next one is visible | ✅ |
| 2026-07-28 | **v1.0.0 NOT tagged.** Infra is green but the dataset is 5 of 32 entries and all are `unverified` — the docs/09 §6 checklist has not been run. Tagging now would rest hard rule 4's honesty claim on unchecked data | ⚠ Kokone |

## 5. Open questions for Kokone

1. Approve the ⚠ rows above — both the 2026-07-15 set and the new
   2026-07-20 domain/SEO set (cheap now, expensive later).
2. H9: HSTS `preload` — go/no-go after the burn-in period
   (semi-irreversible; docs/16 §5 P3).
3. H7: seed list docs/13 §4 — any additions/removals? (Current list leans
   Windows; fine for the primary persona?)
4. Accent hue: harbor blue (`oklch(0.52 0.11 235)`) — approve or pick an
   alternative hue before M1 tokens land.
5. Launch announcement scope: full notify.py fan-out, or soft-launch to
   Discord first for a week of feedback?
6. **D16** — `developer` is now required on every entry. Confirm the naming
   convention for community projects ("VSCodium contributors" vs "VSCodium
   Team"): it has to be answered once, or 32 seed entries will answer it 32
   different ways.
7. ~~**D18 / S1 blocking risk** — View Transitions under a strict CSP.~~
   **Closed 2026-07-27 by S1:** ClientRouter compiles to an external script,
   so View Transitions are safe. The real constraint was island hydration,
   handled by D20. No product decision needed.
8. **H10** — repo setting for Actions-created PRs (docs/12 §4).
9. **S3 and S5 are blocked on you, not on code.** S3 (GitHub issue-form
   prefill limit) needs the repo to exist — **H1**. S5 (PWA offline on the
   real origin) needs the zone and a deploy — **H2/H3**. Everything else in
   M0 is done, so these two are the critical path into M1.

## 6. Suite maintenance

This suite (v1.2, 2026-07-27 — v1.1 was 2026-07-20 post-domain; v1.0 was
2026-07-15, pre-domain) is the contract. Any implementation that
diverges updates the relevant doc **in the same PR** (docs/10 §7-8). Version
bumps: minor for clarifications, major when a hard rule or locked decision
changes.

**v1.2 was a correctness pass, not a feature pass** — no hard rule and no
pre-existing locked decision changed; six blockers, ten high-severity
inconsistencies and thirteen smaller ones were fixed, and D16–D19 were added.
Its lesson is D19: any claim in these docs about a system we do not own
(the ops repo's workflows, a library's version, a platform's default) is a
**hypothesis until checked against that system**. Four of the six blockers
were of exactly that kind and all four were verifiable in under a minute.
