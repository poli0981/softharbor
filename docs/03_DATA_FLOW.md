# 03 — Data Flow

## 1. Authoring flow (how an app enters the list)

```
 proposer opens "App request" issue form (docs/12 §7)
        │  or maintainer decides directly
        ▼
 maintainer verifies inclusion criteria C1–C7 (docs/00 §3)
        ▼
 PR adds exactly one file: src/data/apps/<slug>.json   (+ logo asset if needed)
        ▼
 CI: Zod schema (build) + validate-data.mjs + link check on new URLs
        ▼
 review → squash-merge → deploy workflow → live
```

Rules: one app per PR; PR title `data: add <slug>`; summaries written from
scratch in both EN and VI (hard rule 8); `security.checkedAt` set to the
review date after the maintainer runs the vetting checklist (docs/09 §6).

## 2. Validation layers

| Layer | Where | Catches |
|---|---|---|
| L1 Zod schema | `src/content.config.ts`, runs inside `astro build` | Types, enums, URL shape, summary lengths, date formats |
| L2 `scripts/validate-data.mjs` | CI (`ci.yml` job `gates`) + pre-commit | Cross-file rules Zod can't see: **slug format `^[a-z0-9]+(-[a-z0-9]+)*$` and ≤ 40 chars** (docs/04 §2 — Zod never sees the filename), duplicate slugs vs filenames, duplicate `name` (case/diacritic-insensitive), `categories[]` ids exist in registry, `links.*` are https, no `flagged` entries inside `src/data/apps/`, logo asset exists when `local:` |
| L2b `scripts/check-i18n-parity.mjs` | CI (`ci.yml` job `gates`) + pre-commit | EN/VI dictionary key parity (docs/07 §3) — a **separate** script and a separate `pnpm i18n:check`, because it is triggered by `src/i18n/**`, not `src/data/**` |
| L3 lychee link check | CI (PR: changed files only; weekly: all) | Dead/redirected official links |
| L4 Human review | PR review | Criteria judgment, summary quality, official-domain authenticity |

Both L2 scripts are plain Node (`fs` + `JSON.parse`) — they run **outside**
Astro and must never import from `astro:content`. Failures print a table of
`file → rule → detail` and exit non-zero. Port the structure from
`E:\qoute\scripts\validate-data.ts` and `check-i18n-parity.ts`, which already
implement exactly this contract.

## 3. Build artifacts (derived, never hand-edited)

`astro build` produces, from the single source of truth:

1. **Pages** — `/apps/<slug>` ×2 locales, category pages, grid, welcome.
2. **`/search-index.json`** — serialized MiniSearch index built in
   `search-index.json.ts`: for each app, `slug` (the id) plus the **raw**
   `name`, `tags`, `summaryEn`, `summaryVi` (docs/05 §A2). There are no
   pre-normalized `*Norm` fields: normalization is `processTerm`'s job, and
   MiniSearch applies it on **both** sides — at `addAll` time (so the
   serialized index on disk is already normalized) and to each query term.
   One function, one import, no duplicated logic (docs/05 §A1). Display data
   is **not** stored in the index — it is already in the DOM (docs/05 §A3).
3. **`/api/apps.json`** — full public dataset export (§6).
4. **`/rss.xml`** — 50 newest by `addedAt` (§7).
5. **Sitemap** with hreflang pairs (docs/07 §6).

## 4. Update & re-verification flow

- Editing an app = PR touching its one file; bump `updatedAt`.
- Monthly batch (docs/13 §6): oldest `security.checkedAt` entries get
  re-vetted; refresh `checkedAt` even when nothing changed — the dated
  status is the product's honesty mechanism.

## 5. Quarantine state machine (hard rules 4–5)

```
            add (default)                    maintainer vets (docs/09 §6)
  ┌──────────────┐        ┌──────────────┐
  │  unverified  │ ─────▶ │    clean     │
  └──────┬───────┘        └──────┬───────┘
         │  credible report / scanner hit / vendor advisory
         ▼                        ▼
  ┌─────────────────────────────────────┐
  │              flagged                │  (set in PR or by maintainer)
  └──────────────────┬──────────────────┘
                     ▼  quarantine workflow (docs/12 §4)
   file moved  src/data/apps/x.json → data/quarantine/x.json
   + issue opened: reason, evidence link, date
   + site rebuild → app disappears
                     │
        cleared? reviewed restore PR (status back to clean/unverified,
        new checkedAt, evidence) → file moves back
```

Invariants: `data/quarantine/` is outside the content glob, so quarantined
entries can never render; the *reason* lives in the issue + commit message,
keeping the data file schema-identical for painless restore; deletion of a
data file is only allowed for entries that never shipped.

## 6. `/api/apps.json` contract (for tools & future extensions)

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-15T00:00:00Z",
  "count": 30,
  "license": "CC-BY-SA-4.0",
  "attribution": "SoftHarbor contributors — https://github.com/poli0981/softharbor",
  "apps": [ { /* exactly the schema of docs/04 §1, plus "slug" */ } ]
}
```

`schemaVersion` is an integer, **not** `$schema`: by JSON Schema convention
`$schema` holds a URI to a schema document, and this is a frozen public
contract — getting it right costs nothing now and a breaking change later.

Every app object carries every field of docs/04 §1 including `developer`,
plus `slug`. Because the collection schema is `.strict()`, the export shape
cannot silently grow. Breaking changes require a `schemaVersion` bump and a
decision-log entry.

`generatedAt` is a build timestamp, so this file changes on every deploy even
when the data does not. That is fine here — but it is exactly why `/rss.xml`
carries **no** channel-level `lastBuildDate` (§7, docs/05 §A4): the feed's
byte-determinism is a contract, this file's is not.

## 7. Feed → announcement pipeline

`/rss.xml` item: title = app name, link = `/apps/<slug>`, description =
`summary.en`, pubDate = `addedAt`, guid = slug (stable). The existing
`notify.py` cross-poster consumes this feed on its GitHub Actions cron and
announces new items to Telegram / Discord / Bluesky / Mastodon / X /
Facebook — no new announcement code needed in this repo (integration notes:
docs/13 §5).

## 8. Client-side flow

```
first paint: static HTML (grid server-rendered with ALL apps, unfiltered)
   └─ ShSearch hydrates on idle
        └─ on first focus/keystroke: fetch /search-index.json (~tens of KB)
             └─ MiniSearch.loadJSON → results drive nanostores
                  └─ grid cards toggle visibility (no re-render of content)
errors anywhere: window.onerror / unhandledrejection → ring buffer (A5)
   └─ ShBugReport builds prefilled GitHub issue URL (A6)
```

Graceful degradation: with JS disabled, the full grid, category pages, and
all links still work; only search/filter/theme/lang-switch degrade (links in
the header still navigate to `/vi/…`).
