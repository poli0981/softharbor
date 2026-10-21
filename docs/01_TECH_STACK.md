# 01 — Tech Stack (verified 2026-07-15 · re-verified 2026-07-27 · updated 2026-10-21)

> All version lines below were checked against upstream release channels on
> **2026-07-15**. Install the latest patch within each stated line.
> Dependabot keeps them current afterwards (§5) — it replaced Renovate on
> 2026-10-21; Renovate was never installed and never ran.
>
> **Re-verified 2026-07-27** against `E:\poli0981-dev\package.json` — the
> org's closest sibling project, already shipping Astro 7 on Cloudflare
> Workers. Astro / Svelte / Tailwind / Wrangler / Node confirmed as stated;
> **TypeScript, ESLint, lefthook and knip were all a major behind** and have
> been corrected below. Prefer that project's `package.json` as the reference
> when scaffolding — it is a working install, not a claim.
>
> **Installed at v1.1 (2026-10-21, from `node_modules`):** Node 24.19 ·
> pnpm 11.15.1 · Astro 7.4.1 · Svelte 5.57.2 · `@astrojs/svelte` 9.1.0 ·
> Tailwind 4.3.3 · TypeScript 6.0.3 · MiniSearch 7.2.0 · nanostores 1.5.5 ·
> `@vite-pwa/astro` 1.2.0 · `unplugin-icons` 24.0.0 · Vitest 5.0.5 ·
> Playwright 1.64.1 · `@axe-core/playwright` 4.14.0 · happy-dom 21.0.3 ·
> Wrangler 4.151.3 · ESLint 10.13 · `typescript-eslint` 8.72 · Prettier
> 3.9 · knip 6.42 · lefthook 2.2.2. `package.json` is the authority; this
> line is a snapshot.

## 1. Runtime & toolchain

| Layer | Package | Line (2026-07-15) | Notes |
|---|---|---|---|
| Runtime | Node.js | **24 LTS "Krypton"** (24.x) | Active LTS; maintenance until 2028-04. Node 26 is Current only — do not use until it reaches LTS (2026-10) and CI passes on it. Pin via `.nvmrc` = `24` and `"engines": { "node": ">=24 <25" }`; CI reads `.nvmrc` (`node-version-file`), and `@types/node` majors are held to the same line (Dependabot ignore, §5). |
| Package manager | pnpm | **11.x** (`11.15.1`, `packageManager`) | `packageManager` field pinned; CI's `pnpm/action-setup` reads it (no `version:`), so CI, Dependabot, Workers Builds and laptops run the same pnpm. **Do not set `ignore-scripts`** — pnpm ≥ 10 already blocks dependency install scripts and wants an `allowBuilds` allowlist in `pnpm-workspace.yaml` instead (docs/09 §7). pnpm 11's default **24 h `minimumReleaseAge`** refuses day-old releases — hence Dependabot's 2-day cooldown (§5). |
| Deploy CLI | Wrangler | **4.x** (4.151 at v1.1) | Workers Builds runs `npx wrangler deploy` (main) and `wrangler versions upload` (PRs); CI runs `wrangler deploy --dry-run` to bundle `worker/` and validate `wrangler.jsonc`. Since D25 there **is** a Worker script (`worker/index.ts`), tested under Vitest in Node — the local `workerd` runtime stays blocked in `allowBuilds` (docs/09 §7). Types for the Worker are written by hand (`worker/env.ts`), not `@cloudflare/workers-types`. |

## 2. Framework & UI

| Layer | Package | Line | Notes |
|---|---|---|---|
| Framework | `astro` | **7.x** (7.0.9 at P1; 7.4.1 at v1.1) | Static output. Ships Vite 8 + Rolldown (Rust bundler). Content Layer + Zod validation is the backbone of the data pipeline. `security.csp` provides the per-page meta policy (docs/09 §4); `<ClientRouter />` is **not** used — Astro does not support it with `security.csp` (docs/02 §6). |
| Islands | `svelte` + `@astrojs/svelte` | Svelte **5.x** (5.57 at v1.1) | Runes mode. Only 6 islands exist (docs/02 §5). |
| Styling | `tailwindcss` + `@tailwindcss/vite` | **4.3.x** (≥ 4.3.2) | CSS-first config via `@theme`; tokens in docs/06 §2. |
| Language | `typescript` | **6.x — pinned, do not take 7** | `strict` + `noUncheckedIndexedAccess` (docs/10 §1). **TypeScript 7's native compiler does not expose the programmatic API `astro check` needs**, so `pnpm check` fails outright on it (reproduced in P1, 2026-07-27; upstream tracking: withastro/roadmap discussion 1321). Dependabot ignores this major until Astro says so — see §5.4. |
| State | `nanostores` **only** | 1.x | Cross-island filter/search state (~1 KB). **There is no `@nanostores/svelte` package** — it returns 404 on the registry (verified in P1, 2026-07-27). None is needed: a nanostores atom already satisfies Svelte's store contract (`.subscribe(cb)` fires immediately and returns an unsubscribe), so `$atom` auto-subscription works directly. Bindings exist for React/Vue/Solid/Preact/Lit/Angular precisely because those frameworks lack that contract. |
| Search | `minisearch` | **7.x** | Client-side index; options in docs/05 §A2. Loaded with a dynamic `import()` on first search, so it is not in any page's static bundle. |
| Icons | `unplugin-icons` + `@iconify-json/simple-icons` + `@iconify-json/lucide` | latest | Simple Icons = app logos (SVG, CC0 set — trademark caveat in docs/14 §3d); Lucide = UI icons. In islands: `~icons/lucide/<name>` via `unplugin-icons` (`compiler: 'svelte'`). In `.astro`: `ShIcon.astro` / `src/lib/icon.ts`, which read the same vendored JSON at build time (data-driven names cannot be static imports). Nothing fetched at runtime. |
| Fonts | `@fontsource-variable/bricolage-grotesque`, `@fontsource/be-vietnam-pro`, `@fontsource/ibm-plex-mono` | latest | `latin` + `vietnamese` subsets only (Bricolage's single stylesheet relies on `unicode-range`, docs/06 §3). |
| PWA / offline | `@vite-pwa/astro` | 1.2.x | Installable (manifest linked, PNG icons) with an offline fallback page — not a full precache PWA (docs/08 Part D). Its peer range stops at Astro 5; accepted explicitly in `pnpm-workspace.yaml` because `check:sw` proves the output every build. |
| Feeds & SEO | `@astrojs/rss`, `@astrojs/sitemap` | latest | `/rss.xml` (new apps) + sitemap with hreflang. |
| Third-party runtime (not packages) | Cloudflare Web Analytics beacon · Cloudflare Turnstile `api.js` | — | Loaded by our own code from their origins — the only third-party requests (hard rule 7, D25/D26, docs/09 §4). |

## 3. Quality tooling

| Purpose | Package | Line |
|---|---|---|
| Lint | `eslint` **10.x** flat config + `typescript-eslint` 8.x + `eslint-plugin-astro` 3.x + `eslint-plugin-svelte` 3.x | latest |
| Format | `prettier` 3.x + `prettier-plugin-astro` + `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` | latest |
| Dead code | `knip` | **6.x** |
| Unit / island / script / Worker tests | `vitest` + `@vitest/coverage-v8` + `happy-dom` | **5.x** (5.0.5) — four projects, coverage ratchet (docs/11 §1) |
| End-to-end + a11y | `@playwright/test` + `@axe-core/playwright` | 1.64 / 4.14 — Chromium, desktop + Pixel 7 (docs/11 §5) |
| Icon generation | `sharp` (dev only, `pnpm icons`) | 0.35 — output committed, builds never need it |
| Git hooks | `lefthook` | **2.x** |
| Link checking (CI) | `lychee` via `lycheeverse/lychee-action` | v2 line (v2.9.0) |
| Dep updates | **Dependabot** (`.github/dependabot.yml`) | npm + github-actions, weekly — docs/12 §6 (replaced the never-installed Renovate) |
| CVE / code scanning | `osv-scanner` action + `pnpm audit --prod`; CodeQL (org reusable workflow); SonarCloud automatic analysis | latest |

## 4. Rationale for the contested picks

**Astro over a React/Vite SPA (JSONPrism stack).** The site is a content
directory: hundreds of pages that never change between deploys. Astro
prerenders every page (SEO for "download X" queries), validates the dataset
with Zod at build time (hard rule 2), has i18n routing built in, and ships
zero JS except the islands we opt into. An SPA would invert all of that for
no benefit.

**Svelte 5 over React islands.** Both are supported; Svelte wins on bundle
size for six small islands, and it is the fresher muscle memory
(BookmarkMagic). React remains a documented fallback if a needed library is
React-only (none identified).

**MiniSearch over Fuse.js / Pagefind.** Dataset is small (≤ ~1 000 records ×
~6 short fields). MiniSearch gives prefix + fuzzy search with a custom
`processTerm` hook — exactly where the Vietnamese normalizer plugs in
(docs/05 §A1) — at a fraction of Pagefind's machinery. Pagefind indexes
rendered HTML and is the right tool only if the dataset grows 10×.

**No `@astrojs/cloudflare` adapter.** The adapter exists for SSR on Workers.
SoftHarbor is 100 % prerendered, so `astro build` → `dist/` → Workers Static
Assets needs no adapter. The one Worker of D25 (`worker/`) is a small
hand-written module that Wrangler bundles beside the assets; it runs only
for `assets.run_worker_first` paths (`/api/verify`), so pages stay on the
unbilled asset path and no SSR exists.

## 5. Version & CVE policy

1. **Install latest stable within each line above; never pre-releases.**
2. **Dependabot** runs weekly (Monday), npm and github-actions, with a
   2-day cooldown (pnpm 11's 24 h `minimumReleaseAge`); minor + patch are
   grouped, majors arrive one PR each. GitHub Actions stay pinned to commit
   SHAs with a version comment, and Dependabot bumps both (docs/12 §6).
3. `osv-scanner` + `pnpm audit --prod` run on every PR and push to `main`
   (`ci.yml` `gates` job); a finding fails it. A finding with no patched
   release of the direct dependency is fixed with an `overrides` floor in
   `pnpm-workspace.yaml`, the advisory ids in a comment (docs/09 §7), or a
   tracking issue.
4. Node upgrades follow LTS promotions only (next window: Node 26 → LTS
   2026-10; adopt after CI passes on it), and `@types/node` moves with
   `.nvmrc` — Dependabot ignores its majors until then. **TypeScript is
   exempt from rule 1 until Astro supports TS 7** (§2) — hold at 6.x;
   Dependabot ignores TypeScript majors (D21).
5. Every dependency bump that touches Astro/Vite/Tailwind majors must re-run
   spike S1 (docs/11 §3) before merge — in practice, the full CI including
   the e2e suite on the built site.

## 6. Known risk — Astro 7 freshness

Astro 7 shipped ~3 weeks before this suite; 7.0.x patches are landing
weekly. Risk: a plugin in §2 misbehaves under Rolldown.

- **Mitigation:** spike S1 compiles the *entire* integration set on day one.
- **Fallback (pre-approved):** pin `astro@6.5.x` + its bundled Vite; no other
  stack change. Record the fallback in the decision log if taken.
- **Outcome:** S1 passed on 7.1.3 (2026-07-27); the fallback was never
  needed, and the site runs 7.4.1 at v1.1. One Astro behaviour shaped the
  architecture since: `<ClientRouter />` is unsupported together with
  `security.csp`, so v1.1 moved to native cross-document View Transitions
  (docs/02 §6).
