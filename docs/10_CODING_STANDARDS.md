# 10 — Coding Standards

## 1. TypeScript

`tsconfig.json` extends `astro/tsconfigs/strictest` and adds:

```jsonc
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true
  }
}
```

Rules: no `any` (use `unknown` + narrowing); no non-null `!` outside tests
(lint-enforced; `*.test.ts` is the one exception); no `enum` (union
literals); ESM only; type-only imports use `import type` (lint-enforced).
Shared types derive from the collection schema (`CollectionEntry<'apps'>`)
— never hand-duplicate the data shape. Under `exactOptionalPropertyTypes`,
`foo?: string` means "absent or string", not "may be passed `undefined`":
props filled from optional lookups say `| undefined` explicitly.

**Two deliberate non-TypeScript corners.** `src/scripts/*.js` (the head
scripts — docs/02 §4) are plain *classic* browser JavaScript: Vite copies
them verbatim, so no imports, no TypeScript, linted with browser globals in
`sourceType: script`. `scripts/*.mjs` are plain Node and never import from
`src/` or `astro:content`.

## 2. Naming

| Thing | Convention | Example |
|---|---|---|
| Components (static) | `Sh` + PascalCase `.astro` | `ShAppCard.astro`, `ShIcon.astro` |
| Page bodies | PascalCase `…Page.astro` in `components/pages/` | `AppDetailPage.astro` |
| Islands | `Sh` + PascalCase `.svelte` in `components/islands/` | `ShSearch.svelte` |
| Lib modules | camelCase `.ts` | `issueUrl.ts` |
| Constants | SCREAMING_SNAKE | `LEGAL_VERSION`, `BUDGET`, `PASS_TTL_MS` |
| CSS custom props | `--sh-*` | `--sh-accent` |
| CSS classes (global) | `sh-*` | `sh-panel`, `sh-anim`, `sh-nudge-x` |
| localStorage | `sh:` prefix | `sh:theme` |
| Data files | slug kebab-case | `7-zip.json` |
| Branches | `feat/…`, `fix/…`, `data/…`, `docs/…`, `chore/…` | `data/add-vscodium` |

Islands are leaf components: an island never imports another island;
cross-island communication goes through nanostores only.

**Contacts are never hard-coded.** Every email address on the site — pages,
legal documents — comes from `src/lib/contacts.ts` (D27); `security.txt`,
`SECURITY.md` and the other root files must match it.

## 3. Lint & format

`eslint.config.js` (flat): `@eslint/js` recommended + `typescript-eslint`
**strict** + `eslint-plugin-astro` + `eslint-plugin-svelte` recommended
sets; on `.ts` files, type-aware rules via `projectService`
(`consistent-type-imports`, `no-floating-promises`, `no-misused-promises`,
`await-thenable`, `no-unnecessary-type-assertion` — every island awaits a
fetch or a dynamic import). Project rules:

- **`astro/no-set-html-directive`** bans `set:html` (T4). (An earlier
  hand-rolled `no-restricted-syntax` selector matched nothing for months —
  never replace this with a custom selector.) **One carve-out, scoped to
  five named files**, each injecting only build-time or constant markup:
  `ShIcon.astro` (Lucide SVG via `src/lib/icon.ts` — *the* UI-icon
  component, so the carve-out covers one component instead of every page),
  `ShAppCard.astro` and `AppDetailPage.astro` (app logos via
  `src/lib/logo.ts`), `ShJsonLd.astro` (JSON-LD, `<` escaped) and
  `Base.astro` (the one inline style constant, `src/lib/inlineCss.ts`).
  The only data-derived input is a schema-constrained icon/logo **key**,
  never interpolated into markup; an unknown key throws at build time.
- **`astro/no-unsafe-inline-scripts`** — Astro hashes only the scripts it
  bundles, so a hand-written inline `<script>` body would ship unhashed and
  be refused by the browser. JSON-LD data blocks are allowed.
- **`no-restricted-globals: localStorage`** everywhere in `src/` except
  `src/lib/` — all storage goes through the typed helpers (`legal.ts`,
  `human.ts`, `theme.ts`, `prefs.ts`, `lang.ts`), so every key has exactly
  one reader and writer and the privacy inventory (docs/09 §8) stays true.
- `src/scripts/*.js` lint as classic browser scripts; `scripts/**` and root
  configs with Node globals.

MiniSearch is imported statically only by `src/lib/search.ts` (build time)
and dynamically by `src/lib/searchIndex.ts` (client) — a convention, not a
lint rule (`searchOptions.ts` must stay free of it, or the library lands
back in every page's bundle).

**Icons.** In `.astro`: `<ShIcon name="arrow-right" motion="nudge-x" />` —
build-time Lucide, decorative unless given a `label`. In islands:
`import IconX from '~icons/lucide/x'` (`unplugin-icons`, `compiler:
'svelte'`). Never an `<img>` icon, never a runtime fetch.

**No inline styles — ever.** No `style="…"` attribute in markup and no
`el.style.*` write at runtime: CSP `style-src` drops both silently (docs/09
§4). Use Tailwind utilities — every design token is one (`text-sh-muted`,
`bg-sh-surface`, `border-sh-control`, `shadow-sh-2`) — or a class in
`global.css`; hide with the `hidden` attribute, reorder by moving nodes.
`pnpm check:csp` fails the build on any `style=` in `dist/`; runtime writes
are caught only by the e2e suite's CSP-violation check, so do not write
them.

Prettier 3 + `prettier-plugin-astro` + `prettier-plugin-svelte` +
`prettier-plugin-tailwindcss` (class sorting). No style debates: Prettier
wins; ESLint covers correctness only. `docs/` and `CLAUDE.md` are
Prettier-ignored on purpose — they are hand-wrapped at ~76 columns with
hand-aligned tables.

## 4. Dead code & hooks

`knip.json`: entries = `src/pages/**/*.{astro,ts}`, `scripts/*.mjs`,
`src/scripts/*.js`; project = `src/**`, `scripts/**`, `e2e/**`,
`worker/**`; the Fontsource packages and `tailwindcss` are ignored as
dependencies (they are imported from CSS, which knip does not read). knip
runs in CI (`build` job); unused files, exports or deps fail it.

`lefthook.yml` (lefthook 2 `jobs:` syntax):

```yaml
pre-commit:
  parallel: true
  jobs:
    - name: format
      glob: '*.{ts,js,mjs,astro,svelte,css,json,jsonc,yml,yaml,md}'
      exclude: ['src/data/apps/*.json']
      run: pnpm prettier --write {staged_files}
      stage_fixed: true          # fix-and-restage beats fail-and-retype
    - name: format-data          # by directory: a bulk data change once
      glob: 'src/data/apps/*.json'   # overran Windows' 8 KB command line
      run: pnpm prettier --write src/data/apps
      stage_fixed: true
    - name: lint
      glob: '*.{ts,js,mjs,astro,svelte}'
      run: pnpm eslint {staged_files}
    - name: data
      glob: 'src/data/**'
      run: pnpm validate:data
    - name: i18n                 # separate glob — see docs/07 §3
      glob: 'src/i18n/**'
      run: pnpm i18n:check
pre-push:
  jobs:
    - name: test
      run: pnpm test
```

The `data` and `i18n` hooks are two commands on two globs on purpose. Folding
the parity check into `validate:data` (as an earlier draft did) means a commit
touching only `src/i18n/*.json` never runs it — the exact edit most likely to
break parity would be the one edit that skips the gate.

## 5. Commits & PRs

Conventional Commits, lowercase, imperative: `feat:`, `fix:`, `data:`
(dataset changes — custom type, allowed), `docs:`, `chore:`, `ci:`,
`refactor:`, `test:`. Scope optional (`feat(search): …`); Dependabot uses
`fix(deps)` / `chore(deps)` / `ci`. One logical change per PR; PR
description links the doc section it implements.

Commits are **signed** — the `main` ruleset rejects unsigned ones (docs/12
§8). **Squash is the only merge method**: GitHub cannot sign a rebase merge
under that rule, and a merge commit breaks the required linear history. The
squash title must itself be a valid conventional commit (it feeds the
changelog), and the squash body lists every commit subject of the branch.

## 6. License headers

Every `.ts/.mjs/.js/.astro/.svelte/.css` source file starts with the short
SPDX form (as a `/* */` block in `.js`/`.css`, an HTML comment in
`.svelte`):

```ts
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
```

Data files (`src/data/**`) carry **no** header (JSON has no comments); their
licensing is declared globally by `LICENSE-DATA.md` (docs/14 §1). Config
files at root are exempt.

## 7. Comments & docs-in-code

Comment the *why*, not the *what*; every non-obvious constant links its doc
section (`// docs/05 §A6`). Exported lib functions get a one-line JSDoc.
When code and `docs/**` disagree, code review must fix one of them in the
same PR — divergence is a defect.

## 8. Definition of Done (per PR)

1. `pnpm lint` + `pnpm check` + `pnpm coverage` (thresholds hold) +
   `pnpm build` (which runs validate:data, i18n:check and every `dist/`
   gate) + `pnpm knip` + `pnpm e2e` (after the build) green — CI runs all of
   them and none is advisory.
2. New/changed behavior covered by a test where it lives: a unit test in
   `src/lib/`, an island test for island state, a script test for a build
   script, a Worker test for `worker/`, an e2e test for anything only a
   real browser shows (CSP, top layer, layout).
3. Both locales updated when a UI string changed (CI parity check green),
   keys kept alphabetical.
4. No new dependency without a decision-log line (docs/15 §4); no new
   third-party runtime origin or Worker route without one either (hard
   rules 1 and 7).
5. Docs updated in the same PR when behavior diverges from `docs/**`.
6. For data PRs: vetting checklist run (docs/09 §6), `checkedAt` fresh,
   `evidence` linked for `clean`.
7. Legal text changed materially (Disclaimer, Terms, Privacy) →
   `LEGAL_VERSION` bumped with `LEGAL_UPDATED` (docs/14 Part 2); a test
   enforces it.
8. After the squash merge: the "Workers Builds" check on the merge commit
   is green and production is verified (docs/13 §3).
