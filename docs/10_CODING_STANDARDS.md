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

Rules: no `any` (use `unknown` + narrowing); no non-null `!` outside tests;
no `enum` (union literals); ESM only; type-only imports use `import type`.
Shared types derive from Zod (`z.infer<typeof apps.schema>`) — never
hand-duplicate the data shape.

## 2. Naming

| Thing | Convention | Example |
|---|---|---|
| Components (static) | `Sh` + PascalCase `.astro` | `ShAppCard.astro`, `ShBadge.astro` |
| Islands | `Sh` + PascalCase `.svelte` in `components/islands/` | `ShSearch.svelte` |
| Lib modules | camelCase `.ts` | `issueUrl.ts` |
| Constants | SCREAMING_SNAKE | `LEGAL_VERSION`, `BUDGET` |
| CSS custom props | `--sh-*` | `--sh-accent` |
| localStorage | `sh:` prefix | `sh:theme` |
| Data files | slug kebab-case | `7-zip.json` |
| Branches | `feat/…`, `fix/…`, `data/…`, `docs/…`, `chore/…` | `data/add-vscodium` |

Islands are leaf components: an island never imports another island;
cross-island communication goes through nanostores only.

## 3. Lint & format

`eslint.config.js` (flat): `typescript-eslint` strict-type-checked +
`eslint-plugin-astro` + `eslint-plugin-svelte` recommended sets, plus
project rules:

- `no-restricted-syntax` bans `set:html` (T4) and direct
  `localStorage`/`document.cookie` access outside `src/lib/` (all storage
  goes through typed helpers).
- `no-restricted-imports` bans importing `minisearch` outside
  `src/lib/search.ts` and `src/pages/search-index.json.ts`.

Prettier 3 + `prettier-plugin-astro` + `prettier-plugin-svelte` +
`prettier-plugin-tailwindcss` (class sorting). No style debates: Prettier
wins; ESLint covers correctness only.

## 4. Dead code & hooks

`knip.json`: entries = `astro.config.ts`, `src/pages/**`, `scripts/*.mjs`;
knip runs in CI; unused exports/deps fail the build.

`lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    format:
      glob: '*.{ts,js,mjs,astro,svelte,css,json,jsonc,yml,yaml,md}'
      run: pnpm prettier --write {staged_files}
      stage_fixed: true          # fix-and-restage beats fail-and-retype
    lint:
      glob: '*.{ts,js,mjs,astro,svelte}'
      run: pnpm eslint {staged_files}
    data:
      glob: 'src/data/**'
      run: pnpm validate:data
    i18n:                        # separate glob — see docs/07 §3
      glob: 'src/i18n/**'
      run: pnpm i18n:check
pre-push:
  commands:
    test: { run: pnpm test }
```

The `data` and `i18n` hooks are two commands on two globs on purpose. Folding
the parity check into `validate:data` (as an earlier draft did) means a commit
touching only `src/i18n/*.json` never runs it — the exact edit most likely to
break parity would be the one edit that skips the gate.

## 5. Commits & PRs

Conventional Commits, lowercase, imperative: `feat:`, `fix:`, `data:`
(dataset changes — custom type, allowed), `docs:`, `chore:`, `ci:`,
`refactor:`, `test:`. Scope optional (`feat(search): …`). One logical
change per PR; PR description links the doc section it implements. Squash
merge; the squash title must itself be a valid conventional commit (it
feeds the changelog).

## 6. License headers

Every `.ts/.mjs/.astro/.svelte` source file starts with the short SPDX
form:

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

1. `pnpm lint` + `pnpm test` + `pnpm build` + `pnpm validate:data` +
   `pnpm i18n:check` green.
2. New/changed behavior covered by a unit test when it lives in `src/lib/`.
3. Both locales updated when a UI string changed (CI parity check green).
4. No new dependency without a decision-log line (docs/15 §4).
5. Docs updated in the same PR when behavior diverges from `docs/**`.
6. For data PRs: vetting checklist run (docs/09 §6), `checkedAt` fresh.
