# 00 — Project Overview

> **Project:** SoftHarbor
> **Doc suite version:** 3.0 (2026-10-26, site v1.3)
> **Author:** poli0981 / SkullMute · **License:** code GPL-3.0-only · data CC BY-SA 4.0
> **Platform:** Web (static), Cloudflare Workers Static Assets, canonical `https://softharbor.net`
> — plus one Worker: the site-wide rate limit (D32) and `POST /api/verify` (D25)

## 1. Elevator pitch

SoftHarbor is a fast, bilingual (English/Vietnamese) directory of desktop
software that is **free**, or **free with an optional one-time purchase**, or
**buy-once** — never subscription-only. Each app is one card: logo, original
two-line summary, category tags, supported platforms, pricing badge, license
badge when open source, a dated security status, and direct links to the
**official** homepage, repository, and download page.

The core scenario: you just reinstalled Windows (or set up a new Mac/Linux
box). Instead of googling ten tools one by one — and risking a typosquatted
download site — you open SoftHarbor, filter "Utilities + Windows", and go
straight to every official source. The site itself hosts **no binaries**; it
is a curated map, not a mirror.

## 2. Product principles

1. **Official links only.** Every link points at the developer's own domain
   or official repository. Third-party download portals are banned.
2. **Free or own-it-once.** Subscription-only software never enters the
   list. Free tiers of freemium products qualify only when the free tier is
   self-sufficient forever (see §3).
3. **Trust through transparency, not promises.** License is shown as an SPDX
   badge when open source; security status is shown as *"no known warnings —
   checked <date>"*, never as a guarantee.
4. **No tracking of individuals.** No cookies, no ads, no accounts, nothing
   sold. *(v1.0 said "no analytics, no third-party requests"; amended
   2026-10-21.)* The only third-party requests are two Cloudflare services,
   both started by our own code and disclosed in the Privacy Policy:
   cookieless Web Analytics, which never loads under Global Privacy Control
   (D26), and the legal gate's Turnstile check, loaded only after the
   documents are accepted (D25). localStorage holds preferences and the
   gate's two records only (docs/09 §8).
5. **Fast and tiny.** Static HTML, one small search island, self-hosted
   fonts. Target: < 80 KB JS on `/apps`, LCP < 1.5 s on mid-range mobile.
6. **Bilingual parity.** EN and VI are equal citizens — every string, every
   summary, both locales, enforced by CI.
7. **Not a mirror, not a reviewer.** SoftHarbor never hosts installers,
   never ranks apps by opinion, never publishes reviews. It aggregates facts
   and links.

## 3. Inclusion criteria (the "listable" test)

An app is listable when **all** of the following hold:

| # | Criterion |
|---|---|
| C1 | Desktop software for Windows, macOS, and/or Linux (GUI or notable CLI tool). |
| C2 | Pricing fits one bucket: **free** (fully usable forever at $0), **free-onetime** (free tier + optional single lifetime payment), or **onetime** (single payment, perpetual license). |
| C3 | If the vendor's only paid upgrade is a subscription, the app may still be listed as **free** *only if* the free tier alone fully serves the app's core purpose with no time limit (e.g. a password manager whose free tier is complete). Trials, "free for 30 days", and crippled demos do not qualify. |
| C4 | Official homepage and download page exist on the developer's own domain or official repo (GitHub/GitLab/codeberg…). |
| C5 | Actively maintained *or* stable-and-finished; abandonware with known unpatched vulnerabilities is excluded. |
| C6 | Not malware-adjacent: no bundled adware/toolbars in the official installer, no cracked/keygen tooling, no piracy facilitation. |
| C7 | `security.status` can be set honestly (`unverified` is acceptable at entry; `flagged` blocks listing — see docs/03 §5). |

Edge rulings live in the decision log (`docs/15 §4`) so criteria stay
consistent over time.

## 4. Target users

- **Post-reinstall users** (primary): want a checklist of official download
  links, filtered by platform.
- **Budget-conscious switchers**: looking for a free or buy-once alternative
  to a subscription product, filter by category + pricing.
- **Vietnamese-first users**: need VI descriptions and diacritic-insensitive
  search (`trinh duyet` must find `trình duyệt`).
- **Kokone's own audience**: SkullMute community members receiving new-app
  announcements via the existing `notify.py` cross-poster (RSS → Telegram /
  Discord / Bluesky / Mastodon / X / Facebook).

## 5. Locked decisions

| # | Decision | Choice | Date | Rationale |
|---|---|---|---|---|
| D1 | Name | **SoftHarbor** | 2026-07-15 | Portfolio-consistent compound noun; "harbor" = safe berth after a reinstall |
| D2 | Hosting | Workers Static Assets · custom domain **`softharbor.net`** (Free zone, apex canonical, `www` → 301, workers.dev route disabled) — *amended 2026-07-20; originally workers.dev-only* | 2026-07-20 | Static asset requests are unbilled; domain purchased pre-launch → no migration. Details: docs/16 |
| D3 | Code license | GPL-3.0-only | 2026-07-15 | Consistent with entire poli0981 org |
| D4 | Data license | **CC BY-SA 4.0** (`src/data/**`) | 2026-07-15 | Copyleft spirit for the curated dataset; see docs/14 §1 |
| D5 | Framework | Astro 7 static + Svelte 5 islands | 2026-07-15 | Zod-validated content collections, built-in i18n routing, ~0 JS baseline |
| D6 | Styling | Tailwind CSS 4.3.x | 2026-07-15 | Current stable line |
| D7 | Runtime | Node 24 LTS (Krypton) — *amended 2026-10-23: **Node 26** (`.nvmrc` `26`, engines `>=26 <27`, `@types/node` 26), taken five days before its LTS promotion on 2026-10-28 at the owner's request; Node 24 entered maintenance on 2026-10-20* | 2026-07-15 | Active LTS; Node 26 not LTS until 2026-10 |
| D8 | Search | MiniSearch, client-side, VN-insensitive normalizer | 2026-07-15 | Lightweight; dataset ≤ ~1 000 entries |
| D9 | Fonts | Bricolage Grotesque (display) · Be Vietnam Pro (body) · IBM Plex Mono (badges) | 2026-07-15 | All ship Vietnamese subsets; distinctive, non-generic |
| D10 | Security field | `status/evidence/checkedAt` model — never boolean "virus: no" | 2026-07-15 | Legal defensibility; honesty |
| D11 | Flagged handling | Quarantine folder + issue, never delete | 2026-07-15 | Audit trail, restorable |
| D12 | Legal gate | First-visit overlay, `sh:legal` versioned in localStorage — *amended 2026-10-21: a second step, the Turnstile human check (D25), `sh:human`* | 2026-07-15 | CommandForge pattern adapted to web |
| D13 | Locale routing | `en` default unprefixed, `vi` at `/vi/…`, **no auto-redirect** | 2026-07-15 | SEO-safe; a dismissible banner suggests VI instead (docs/07 §5) |
| D14 | Analytics | None in v1 | 2026-07-15 | ⛔ **superseded 2026-10-21 by D26** — Simplest honest privacy policy |
| D15 | Cross-island state | nanostores — **`nanostores` alone** (amended 2026-07-27: `@nanostores/svelte` does not exist and is not needed; atoms already satisfy Svelte's store contract) | 2026-07-27 | Astro-recommended, ~1 KB |
| D16 | `developer` field | **Required** in the schema and rendered on the detail page | 2026-07-27 | Lets a reader match "who makes this" against the domain they're about to click — the same trust proposition as "official links only" (docs/04 §2, docs/06 §5) |
| D17 | Package manager | **pnpm 10** kept, though sibling org projects use npm — *amended: the line is **pnpm 11** since P1 (`packageManager: pnpm@11.15.1`); `ignore-scripts` was dropped for `allowBuilds` (docs/09 §7)* | 2026-07-27 | `reusable-web-react.yml` accepts `package-manager: pnpm`, so nothing is lost; docs/09 §7's `ignore-scripts` + `--frozen-lockfile` posture stays intact |
| D18 | CSP / inline scripts | Zero inline scripts → plain `script-src 'self'` | 2026-07-27 | ⛔ **superseded by D20 the same week** — S1 proved it unachievable: Astro's island hydration emits inline scripts on any page with a `client:*` directive |
| D20 | CSP (actual) | **Split policy.** `script-src`/`style-src` come from Astro's `security.csp` per-page `<meta>` with generated hashes; `_headers` carries **only** `frame-ancestors 'none'` — *amended 2026-10-21: the meta tag is moved first in `<head>`, the head scripts are hashed `/_astro/` files from `src/scripts/`, the policy adds exactly the two Cloudflare origins of D25/D26 and one style hash, and `check:csp` gates the build* | 2026-07-27 | Header CSP and meta CSP are enforced as two policies and a resource must pass both — so `_headers` must not also declare script-src or the intersection kills Astro's hashes. Theme snippet still externalised to `public/theme.js` (since v1.1: `src/scripts/theme.js`). Verified by recomputing every inline hash against the emitted policy (docs/09 §4) |
| D21 | TypeScript major | **Hold at 6.x**; do not adopt TS 7 — *amended 2026-10-23: TS 6 and TS 7 side by side. `typescript` is the `@typescript/typescript6` wrapper — the TS 6 API that `astro check`, typescript-eslint and svelte2tsx load — and `@typescript/native` is TS 7, whose `tsc --noEmit` checks every `.ts` file in `pnpm check` (docs/01 §2)* | 2026-07-27 | TS 7's native compiler does not expose the API `astro check` needs, so `pnpm check` fails on it (docs/01 §2) |
| D22 | Search fuzziness | `FUZZY = 0.25`; the `gmip → GIMP` vector is retired | 2026-07-27 | Measured, not guessed: `gmip` needs 2 edits on 4 chars (fuzzy ≥ 0.375), and at that setting the *correctly spelled* query `gimp` stops being exact. Precision on correct spellings beats one contrived typo (docs/05 §A2) |
| D19 | Suite correctness | Spec claims about external systems are **verified against the real system** before they enter the docs | 2026-07-27 | The 2026-07-27 audit found two ops-repo workflows that never existed and four stale tool majors — all cheap to catch on paper, all expensive to catch in CI |
| D23 | Logo fallback | Third `logo` form `monogram` (initials) when no brand mark is available | 2026-07-29 | Simple Icons covers only part of the catalogue; docs/14 §3d sanctions no other source than the vendor's own assets (docs/15 §4) |
| D24 | Seed import | The seed batch was exempt from one-app-per-PR | 2026-07-29 | 286 machine-uniform files; the rule resumes for every later entry (docs/15 §4) |
| D25 | Server code | **One Worker, for `POST /api/verify` only** (amends hard rule 1): the legal gate's step 2 — Turnstile after acceptance, token checked server-side, rate-limited, everything fails **open**; `run_worker_first` keeps pages and assets on the unbilled asset path — *amended 2026-10-26 by D32: the Worker now runs first for pages, feeds and data too, for the site-wide rate limit; content-hashed assets stay asset-first* | 2026-10-21 | Consent-first human check on a public site without ever locking a person out (docs/09 §4a, docs/08 Part E) |
| D26 | Analytics | **Cloudflare Web Analytics, honouring Global Privacy Control** (supersedes D14; amends hard rule 7): cookieless beacon, never under GPC, production host only | 2026-10-21 | Knowing whether the site works and is used, with the least data and a privacy signal honoured (docs/09 §8) |
| D27 | Contacts | **One address per purpose at `@poli0981.dev`** — `src/lib/contacts.ts`; `contact@softharbor.net` retired; mail hosted by Google | 2026-10-21 | A message reaches the right queue; `sponsor@` deliberately unused (docs/14 Part 2) |
| D28 | Toolchain | **Node 26 + TypeScript 6/7 side by side** (amends D7 and D21) — `.nvmrc` 26; `typescript` = the `@typescript/typescript6` API wrapper, `@typescript/native` = TS 7, whose `tsc --noEmit` now type-checks every `.ts` file in `pnpm check` | 2026-10-23 | Node 24 entered maintenance 2026-10-20; TS 7 ships no API yet, which astro check, typescript-eslint and svelte2tsx need (docs/01 §2) |
| D32 | Rate limiting | **Site-wide rate limit in the Worker** (amends hard rule 1 and D25): `run_worker_first` is `/*` minus the files a page loads (`/_astro/*`, icons, service worker); every request it routes spends one unit of `SITE_LIMITER` — 60 per 10 s per IPv4 or IPv6 /64, per location — and over it gets the branded `/errors/429` page (JSON under `/api/`), `Retry-After: 10`; fails **open** | 2026-10-26 | A flood or a runaway scraper gets refused cheaply with our own page instead of the Free zone's default; configured and tested in the repo (wrangler.jsonc, e2e/worker.spec.ts), not in a dashboard (docs/08 Part F) |
| D29 | Code analysis | **SonarQube Cloud CI-based analysis with coverage** (`ci.yml` `sonar` job, not a required check) replaces Automatic Analysis | 2026-10-23 | Automatic Analysis cannot import coverage; a CI scan measures the same lcov the ratchet gates (docs/12 §2, docs/11 §1) |

## 6. Identifiers (locked)

| Identifier | Value |
|---|---|
| Repo slug | `poli0981/softharbor` |
| Canonical origin | `https://softharbor.net` (apex; `www` 301s to it) |
| Worker name | `softharbor` — code in `worker/`: the site-wide rate limit (D32) and one endpoint, `POST /api/verify` (D25); workers.dev route disabled; versioned preview URLs only (docs/16 §3) |
| Contact email | One address per purpose at `@poli0981.dev` — `src/lib/contacts.ts`, page `/contact` (D27; `contact@softharbor.net` retired) |
| Component prefix | `Sh*` (islands: `ShLegalGate`, `ShSearch`, `ShFilterSheet`, `ShLangSwitch`, `ShPrefs`, `ShBugReport`) |
| CSS custom property prefix | `--sh-*` |
| localStorage keys | `sh:legal`, `sh:human`, `sh:lang`, `sh:theme`, `sh:scrollbar`, `sh:motion` |
| App data path | `src/data/apps/<slug>.json` (filename = slug) |
| Quarantine path | `data/quarantine/<slug>.json` |
| Public data endpoints | `/api/apps.json`, `/rss.xml`, `/sitemap-index.xml` |
| Runtime secret | `TURNSTILE_SECRET` (Worker runtime secret, never in the repo — docs/08 Part E) |

## 7. Non-goals (v1)

User accounts, ratings, comments, or reviews · hosting or proxying any
binary · automatic scraping of vendor metadata (all entries are hand-written)
· mobile-app listings · package-manager command snippets (winget/brew —
post-v1 backlog) · zone security add-ons kept deliberately OFF at launch:
rate limiting, Bot Fight Mode, paid Custom Errors (reasons & activation
recipes in docs/16 §9 — the Worker's own rate limits, site-wide since
D32, are not a zone feature) · server-rendered or gated pages of any kind
(D25 allows one verification endpoint and D32 one rate limit, nothing
more: a flood gets a 429, a person reading never does) · a third
locale (JP is a v1.2 candidate, docs/15).

## 8. Document map

See `CLAUDE.md` for the full table. Reading order for a new contributor:
00 → 01 → 02 → 04 → 06 → 07, then the rest as needed.

## 9. Human-only action items (Kokone)

| # | Action | Needed by |
|---|---|---|
| H1 | Create repo `poli0981/softharbor`, default branch `main`, add GPL-3.0 LICENSE via GitHub picker | P1 |
| H2 | Onboard the `softharbor.net` zone: add to Cloudflare (Free plan), set nameservers at the registrar (skip if Cloudflare Registrar), enable DNSSEC + transfer lock + auto-renew (docs/16 §2) | P1 |
| H3 | ~~Create Cloudflare API token … and add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets~~ — **retired 2026-07-28**: Workers Builds deploys; delete the unused secrets (docs/12 §1) | — |
| H4 | Enable GitHub *Private vulnerability reporting* + *Issues* on the repo (the issue forms and `SECURITY.md` route reports there — ⚠ verify the setting) | P6 |
| H5 | ~~Set up Email Routing → `contact@softharbor.net` + DMARC~~ — **superseded 2026-10-21 by D27**: purpose addresses at `@poli0981.dev`, Google-hosted. Still open: decide whether softharbor.net keeps its Email Routing records (docs/16 §6) | v1.1 |
| H6 | Review & approve all legal drafts in docs/14 before first public deploy — ✅ 2026-07-28; sign-off on the 2026-10-21 rewrite ⚠ verify (docs/14 Part 4) | P6 / v1.1 |
| H7 | Approve the seed list — **326 apps imported 2026-07-29** (docs/13 §4, D24) | P6 |
| H8 | Create the GSC **Domain property** for `softharbor.net` (DNS TXT verify) + enable Crawler Hints; submit sitemap & import to Bing at launch (docs/16 §8) — the verification TXT is published (observed 2026-10-21); the rest ⚠ verify | P6 |
| H9 | Decide on HSTS phase P3 (`preload` submission — semi-irreversible, docs/16 §5) — the header already carries `preload` (observed 2026-10-21, docs/15 §5) | post-launch |
| H10 | Enable *Settings → Actions → General → **Allow GitHub Actions to create and approve pull requests*** — without it the nightly quarantine sweep cannot open its PR and hard rule 5 stops being enforced mechanically (docs/12 §4) — ✅ enabled | P6 |
| H11 | Set the Worker's runtime secret **`TURNSTILE_SECRET`** (dashboard → Variables and Secrets, or `wrangler secret put`) — without it every check answers 503 and the gate silently fails open for everyone (docs/08 Part E) — ✅ set (verified 2026-10-21: a junk token gets `403 rejected`); redo whenever the Worker is re-created | v1.1 |
| H12 | Turn the zone's **Speed Brain** off — Cloudflare refuses speculative prefetch on Worker requests (503); production still sent a `Speculation-Rules` header on 2026-10-21 (docs/16 §9) | v1.1 |
| H13 | *Optional:* deploy the zone **rate-limiting rule as layer 1** in front of the Worker's limit — one rule, URI Path starts with `/` and not a verified bot, 150 requests per 10 s per IP, Block 10 s (step-by-step and a verification command: docs/16 §9.1). It blocks floods before the Worker is billed; nothing in the repository depends on it | v1.3 |
