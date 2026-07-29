# 00 — Project Overview

> **Project:** SoftHarbor
> **Doc suite version:** 1.2 (2026-07-27)
> **Author:** poli0981 / SkullMute · **License:** code GPL-3.0-only · data CC BY-SA 4.0
> **Platform:** Web (static), Cloudflare Workers Static Assets, canonical `https://softharbor.net`

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
4. **Zero tracking.** No analytics, no cookies, no third-party requests in
   v1. localStorage holds only user preferences.
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
| D7 | Runtime | Node 24 LTS (Krypton) | 2026-07-15 | Active LTS; Node 26 not LTS until 2026-10 |
| D8 | Search | MiniSearch, client-side, VN-insensitive normalizer | 2026-07-15 | Lightweight; dataset ≤ ~1 000 entries |
| D9 | Fonts | Bricolage Grotesque (display) · Be Vietnam Pro (body) · IBM Plex Mono (badges) | 2026-07-15 | All ship Vietnamese subsets; distinctive, non-generic |
| D10 | Security field | `status/evidence/checkedAt` model — never boolean "virus: no" | 2026-07-15 | Legal defensibility; honesty |
| D11 | Flagged handling | Quarantine folder + issue, never delete | 2026-07-15 | Audit trail, restorable |
| D12 | Legal gate | First-visit overlay, `sh:legal` versioned in localStorage | 2026-07-15 | CommandForge pattern adapted to web |
| D13 | Locale routing | `en` default unprefixed, `vi` at `/vi/…`, **no auto-redirect** | 2026-07-15 | SEO-safe; a dismissible banner suggests VI instead (docs/07 §5) |
| D14 | Analytics | None in v1 | 2026-07-15 | Simplest honest privacy policy |
| D15 | Cross-island state | nanostores — **`nanostores` alone** (amended 2026-07-27: `@nanostores/svelte` does not exist and is not needed; atoms already satisfy Svelte's store contract) | 2026-07-27 | Astro-recommended, ~1 KB |
| D16 | `developer` field | **Required** in the schema and rendered on the detail page | 2026-07-27 | Lets a reader match "who makes this" against the domain they're about to click — the same trust proposition as "official links only" (docs/04 §2, docs/06 §5) |
| D17 | Package manager | **pnpm 10** kept, though sibling org projects use npm | 2026-07-27 | `reusable-web-react.yml` accepts `package-manager: pnpm`, so nothing is lost; docs/09 §7's `ignore-scripts` + `--frozen-lockfile` posture stays intact |
| D18 | CSP / inline scripts | Zero inline scripts → plain `script-src 'self'` | 2026-07-27 | ⛔ **superseded by D20 the same week** — S1 proved it unachievable: Astro's island hydration emits inline scripts on any page with a `client:*` directive |
| D20 | CSP (actual) | **Split policy.** `script-src`/`style-src` come from Astro's `security.csp` per-page `<meta>` with generated hashes; `_headers` carries **only** `frame-ancestors 'none'` | 2026-07-27 | Header CSP and meta CSP are enforced as two policies and a resource must pass both — so `_headers` must not also declare script-src or the intersection kills Astro's hashes. Theme snippet still externalised to `public/theme.js`. Verified by recomputing every inline hash against the emitted policy (docs/09 §4) |
| D21 | TypeScript major | **Hold at 6.x**; do not adopt TS 7 | 2026-07-27 | TS 7's native compiler does not expose the API `astro check` needs, so `pnpm check` fails on it (docs/01 §2) |
| D22 | Search fuzziness | `FUZZY = 0.25`; the `gmip → GIMP` vector is retired | 2026-07-27 | Measured, not guessed: `gmip` needs 2 edits on 4 chars (fuzzy ≥ 0.375), and at that setting the *correctly spelled* query `gimp` stops being exact. Precision on correct spellings beats one contrived typo (docs/05 §A2) |
| D19 | Suite correctness | Spec claims about external systems are **verified against the real system** before they enter the docs | 2026-07-27 | The 2026-07-27 audit found two ops-repo workflows that never existed and four stale tool majors — all cheap to catch on paper, all expensive to catch in CI |

## 6. Identifiers (locked)

| Identifier | Value |
|---|---|
| Repo slug | `poli0981/softharbor` |
| Canonical origin | `https://softharbor.net` (apex; `www` 301s to it) |
| Worker name | `softharbor` (workers.dev route disabled; versioned preview URLs only — docs/16 §3) |
| Contact email | `contact@softharbor.net` via Cloudflare Email Routing (docs/16 §6) |
| Component prefix | `Sh*` |
| CSS custom property prefix | `--sh-*` |
| localStorage keys | `sh:legal`, `sh:lang`, `sh:theme` |
| App data path | `src/data/apps/<slug>.json` (filename = slug) |
| Quarantine path | `data/quarantine/<slug>.json` |
| Public data endpoints | `/api/apps.json`, `/rss.xml`, `/sitemap-index.xml` |

## 7. Non-goals (v1)

User accounts, ratings, comments, or reviews · hosting or proxying any
binary · automatic scraping of vendor metadata (all entries are hand-written)
· mobile-app listings · package-manager command snippets (winget/brew —
post-v1 backlog) · zone security add-ons kept deliberately OFF at launch:
rate limiting, Bot Fight Mode, paid Custom Errors (reasons & activation
recipes in docs/16 §9) · a third locale (JP is a v1.2 candidate, docs/15).

## 8. Document map

See `CLAUDE.md` for the full table. Reading order for a new contributor:
00 → 01 → 02 → 04 → 06 → 07, then the rest as needed.

## 9. Human-only action items (Kokone)

| # | Action | Needed by |
|---|---|---|
| H1 | Create repo `poli0981/softharbor`, default branch `main`, add GPL-3.0 LICENSE via GitHub picker | P1 |
| H2 | Onboard the `softharbor.net` zone: add to Cloudflare (Free plan), set nameservers at the registrar (skip if Cloudflare Registrar), enable DNSSEC + transfer lock + auto-renew (docs/16 §2) | P1 |
| H3 | Create Cloudflare API token ("Edit Cloudflare Workers" template) and add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets | P6 |
| H4 | Enable GitHub *Private vulnerability reporting* + *Issues* on the repo | P6 |
| H5 | Set up Email Routing → `contact@softharbor.net` + DMARC record, then fill `<contact-email>` in docs/14 drafts and security.txt (docs/16 §6) | P6 |
| H6 | Review & approve all legal drafts in docs/14 before first public deploy | P6 |
| H7 | Approve the seed list — **290 apps imported 2026-07-29** (docs/13 §4, D24) | P6 |
| H8 | Create the GSC **Domain property** for `softharbor.net` (DNS TXT verify) + enable Crawler Hints; submit sitemap & import to Bing at launch (docs/16 §8) | P6 |
| H9 | Decide on HSTS phase P3 (`preload` submission — semi-irreversible, docs/16 §5) | post-launch |
| H10 | Enable *Settings → Actions → General → **Allow GitHub Actions to create and approve pull requests*** — without it the nightly quarantine sweep cannot open its PR and hard rule 5 stops being enforced mechanically (docs/12 §4) | P6 |
