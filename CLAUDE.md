# CLAUDE.md — SoftHarbor

> Root instruction file for AI-assisted development (Claude Code).
> Read this first. Detailed specs live in `docs/00–16`.
> Suite version: 1.2 (2026-07-27) · Author: poli0981 / SkullMute

## What this project is

**SoftHarbor** is a fully static, bilingual (EN/VI) directory of desktop
software that is either **free** or purchasable with a **single one-time
payment** — never subscription-only. It exists so that after a fresh Windows
install (or macOS/Linux setup) you open one page, filter by category, and jump
straight to each app's **official** homepage/repo/download page instead of
googling every tool one by one.

- Repo: `poli0981/softharbor` · License: code **GPL-3.0-only**, data **CC BY-SA 4.0**
- Hosting: **Cloudflare Workers Static Assets** on canonical
  **`https://softharbor.net`** (Free zone; `www` 301s to apex; workers.dev
  route disabled, PR previews only — see `docs/16`). No Worker script, no
  backend, no database.
- Stack: Node 24 LTS · pnpm 10 · Astro 7 (static output) · Svelte 5 islands ·
  Tailwind CSS 4.3 · TypeScript strict · Wrangler 4 — full table in `docs/01`

## Hard rules (never violate)

1. **Static-first.** No `main` Worker script, no SSR, no server code, no
   database, no serverless functions. All interactivity is client-side Svelte
   islands. If a feature seems to need a server, redesign it or move it to a
   GitHub Actions workflow.
2. **Data is law.** Every listed app is exactly one JSON file in
   `src/data/apps/<slug>.json`, validated by the Zod schema in
   `src/content.config.ts`. Invalid data must fail the build. Never bypass the
   schema, never hand-edit generated indexes.
3. **No subscription-only software.** `pricing` ∈ `free | free-onetime |
   onetime`. If full desktop use requires a recurring payment, the app does
   not enter the list (inclusion criteria: `docs/00 §3`).
4. **Never assert "no virus".** Security is expressed only as
   `security.status: clean | flagged | unverified` + `checkedAt` date +
   optional `evidence` URL. UI copy must say "no known warnings as of
   <date>", never guarantee safety.
5. **Flagged ⇒ quarantine, never delete.** Any app with `status: "flagged"`
   is moved by workflow to `data/quarantine/` (outside the content glob) and
   disappears from the site on next build. History is preserved; restoration
   is a reviewed PR. See `docs/03 §5`.
6. **Bilingual parity.** Every user-facing UI string exists in both
   `src/i18n/en.json` and `src/i18n/vi.json`; every app has `summary.en` and
   `summary.vi`. A missing key in either language fails CI.
7. **Self-host everything.** Fonts (Fontsource), logos (Simple Icons /
   `src/assets/logos/`), scripts, styles. Zero third-party requests at
   runtime. `Content-Security-Policy: default-src 'self'` must keep passing
   (`docs/09 §4`).
8. **Official links only, original words only.** `links.*` must point to the
   developer's official domain or official repo. Summaries are written from
   scratch — never paste vendor marketing copy or Wikipedia text (data is
   CC BY-SA 4.0; provenance must be clean).

## Build phases

Work in order. Do not start a phase before the previous phase's exit
criteria (`docs/15`) are met.

| Phase | Scope | Key docs |
|---|---|---|
| **P1 — Scaffold & spikes** | `pnpm create astro`, add integrations, run spikes S1–S5, commit toolchain baseline | 01, 11 |
| **P2 — Data layer** | Content collections, Zod schema, categories registry, `validate-data` script, 5 seed apps | 03, 04 |
| **P3 — Static pages** | Welcome, `/apps`, `/apps/[slug]`, `/categories/[id]`, layouts, tokens, fonts, dark mode (no JS yet) | 02, 06 |
| **P4 — Islands** | Search/filter/sort (MiniSearch + nanostores), language switcher, theme toggle, legal gate | 05, 06, 07, 14 |
| **P5 — Resilience & outputs** | 404/offline/PWA, dormant error templates, `/api/apps.json`, `/rss.xml`, bug-report button | 03, 05, 08 |
| **P6 — Ship** | `_headers`, CI/CD wiring, deploy, seed 30 apps, launch checklist | 09, 10, 12, 13 |

## Commands

```bash
pnpm install            # Node 24 LTS required (see .nvmrc / engines)
pnpm dev                # astro dev
pnpm build              # astro build → dist/
pnpm preview            # astro preview
pnpm lint               # eslint + prettier --check
pnpm test               # vitest run
pnpm validate:data      # node scripts/validate-data.mjs   (L2 data rules)
pnpm i18n:check         # node scripts/check-i18n-parity.mjs (EN/VI key parity)
pnpm deploy             # wrangler deploy (CI does this on main)
```

## Naming & identifiers (locked)

- Component prefix `Sh*`: `ShAppCard.astro`, `ShSearch.svelte`,
  `ShLegalGate.svelte`, `ShFilterSheet.svelte`, `ShLangSwitch.svelte`,
  `ShThemeToggle.svelte`
- CSS custom properties: `--sh-*` · localStorage keys: `sh:legal`, `sh:lang`,
  `sh:theme`
- Worker name: `softharbor` · Data: `src/data/apps/` · Quarantine:
  `data/quarantine/`

## Document map

| Doc | Contents |
|---|---|
| `docs/00_PROJECT_OVERVIEW.md` | Pitch, principles, inclusion criteria, locked decisions, identifiers, human-only TODOs |
| `docs/01_TECH_STACK.md` | Verified versions (2026-07-15), rationale, upgrade & CVE policy |
| `docs/02_ARCHITECTURE.md` | Static-first architecture, project tree, routing, wrangler config |
| `docs/03_DATA_FLOW.md` | Authoring → validation → build → indexes → quarantine → feeds |
| `docs/04_DATA_SCHEMA.md` | Zod schema, field reference, categories registry, examples |
| `docs/05_ALGORITHMS.md` | VN-insensitive normalizer, search, filters, feed, ring buffer, issue-URL builder |
| `docs/06_UI_SPEC.md` | Design tokens, fonts, layouts, card anatomy, motion, a11y |
| `docs/07_I18N.md` | EN/VI routing, dictionaries, hreflang, switcher, search across locales |
| `docs/08_PLATFORM_CLOUDFLARE.md` | Workers setup guide, error-page matrix, PWA/offline, future custom-domain appendix |
| `docs/09_SECURITY_PRIVACY.md` | Threat model, `_headers`/CSP, security.txt, data-vetting policy, privacy |
| `docs/10_CODING_STANDARDS.md` | TS/ESLint/Prettier/Knip/lefthook, naming, commits, DoD |
| `docs/11_TESTING.md` | Test pyramid, P0 spikes S1–S5, coverage targets |
| `docs/12_CI_CD.md` | Workflows (validate/deploy/quarantine/link-check), `poli0981/.github` wiring, issue forms |
| `docs/13_RELEASE.md` | Launch checklist, seed list, versioning, notify.py announcement |
| `docs/14_LEGAL.md` | Licensing model, legal-gate spec, bilingual drafts (Disclaimer/Privacy/Terms/Trademarks/Third-party) |
| `docs/15_ROADMAP.md` | Milestones, post-v1 backlog, decision log, open questions |
| `docs/16_DOMAIN_SEO.md` | `softharbor.net`: zone/DNS/DNSSEC, redirects, HSTS, email, robots/JSON-LD, GSC/Bing/IndexNow, off-by-choice features |
