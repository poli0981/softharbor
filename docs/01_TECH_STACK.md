# 01 — Tech Stack (verified 2026-07-15)

> All version lines below were checked against upstream release channels on
> **2026-07-15**. Install the latest patch within each stated line. Renovate
> keeps them current afterwards (§5).

## 1. Runtime & toolchain

| Layer | Package | Line (2026-07-15) | Notes |
|---|---|---|---|
| Runtime | Node.js | **24 LTS "Krypton"** (24.x) | Active LTS; maintenance until 2028-04. Node 26 is Current only — do not use until it reaches LTS (2026-10). Pin via `.nvmrc` = `24` and `"engines": { "node": ">=24 <25" }`. |
| Package manager | pnpm | **10.x** | `packageManager` field pinned; `pnpm config set ignore-scripts true` (docs/09 §7). |
| Deploy CLI | Wrangler | **4.x** (latest) | Only `deploy` / `versions upload` are used; no local Worker runtime needed (pure assets). |

## 2. Framework & UI

| Layer | Package | Line | Notes |
|---|---|---|---|
| Framework | `astro` | **7.0.x** (≥ 7.0.9) | Static output. Ships Vite 8 + Rolldown (Rust bundler). Content Layer + Zod validation is the backbone of the data pipeline. |
| Islands | `svelte` + `@astrojs/svelte` | Svelte **5.x** | Runes mode. Only 6 islands exist (docs/02 §5). |
| Styling | `tailwindcss` + `@tailwindcss/vite` | **4.3.x** (≥ 4.3.2) | CSS-first config via `@theme`; tokens in docs/06 §2. |
| Language | `typescript` | **5.x** latest | `strict` + `noUncheckedIndexedAccess` (docs/10 §1). |
| State | `nanostores` + `@nanostores/svelte` | latest | Cross-island filter/search state (~1 KB). |
| Search | `minisearch` | **7.x** | Client-side index; options in docs/05 §A2. |
| Icons | `unplugin-icons` + `@iconify-json/simple-icons` + `@iconify-json/lucide` | latest | Simple Icons = app logos (SVG, CC0 set — trademark caveat in docs/14 §3d); Lucide = UI icons. Build-time inlined; nothing fetched at runtime. |
| Fonts | `@fontsource-variable/bricolage-grotesque`, `@fontsource/be-vietnam-pro`, `@fontsource/ibm-plex-mono` | latest | Import `latin` + `vietnamese` subsets only. |
| PWA / offline | `@vite-pwa/astro` | latest | Offline fallback page only — not a full precache PWA (docs/08 §D). |
| Feeds & SEO | `@astrojs/rss`, `@astrojs/sitemap` | latest | `/rss.xml` (new apps) + sitemap with hreflang. |

## 3. Quality tooling

| Purpose | Package | Line |
|---|---|---|
| Lint | `eslint` 9.x flat config + `typescript-eslint` 8.x + `eslint-plugin-astro` + `eslint-plugin-svelte` | latest |
| Format | `prettier` 3.x + `prettier-plugin-astro` + `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` | latest |
| Dead code | `knip` | **lastest** |
| Unit tests | `vitest` | latest line compatible with the toolchain (Vitest bundles its own Vite — no conflict with Astro's Vite 8; confirm in spike S1) |
| Git hooks | `lefthook` | 1.x |
| Link checking (CI) | `lychee` via `lycheeverse/lychee-action` | v2 line |
| Dep updates | Renovate app | config in docs/12 §6 |
| CVE scan | `osv-scanner` action + `pnpm audit` | latest |

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
Assets needs no adapter, no Worker script, and no runtime billing.

## 5. Version & CVE policy

1. **Install latest stable within each line above; never pre-releases.**
2. Renovate runs weekly (grouped minor/patch, separate majors) and pins
   GitHub Actions to commit SHAs.
3. `osv-scanner` + `pnpm audit --prod` run on every PR; a *critical* finding
   with no patched version blocks merge and opens a tracking issue.
4. Node upgrades follow LTS promotions only (next window: Node 26 → LTS
   2026-10; adopt after CI passes on it).
5. Every dependency bump that touches Astro/Vite/Tailwind majors must re-run
   spike S1 (docs/11 §3) before merge.

## 6. Known risk — Astro 7 freshness

Astro 7 shipped ~3 weeks before this suite; 7.0.x patches are landing
weekly. Risk: a plugin in §2 misbehaves under Rolldown.

- **Mitigation:** spike S1 compiles the *entire* integration set on day one.
- **Fallback (pre-approved):** pin `astro@6.5.x` + its bundled Vite; no other
  stack change. Record the fallback in the decision log if taken.
