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

## 6. Suite maintenance

This suite (v1.1, 2026-07-20 — v1.0 was 2026-07-15, pre-domain) is the
contract. Any implementation that
diverges updates the relevant doc **in the same PR** (docs/10 §7-8). Version
bumps: minor for clarifications, major when a hard rule or locked decision
changes.
