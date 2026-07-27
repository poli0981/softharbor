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
| L2 `scripts/validate-data.mjs` | CI + pre-commit | Cross-file rules Zod can't see: duplicate slugs vs filenames, duplicate `name` (case/diacritic-insensitive), `categories[]` ids exist in registry, `links.*` are https, no `flagged` entries inside `src/data/apps/`, logo asset exists when `local:` |
| L3 lychee link check | CI (PR: changed files only; weekly: all) | Dead/redirected official links |
| L4 Human review | PR review | Criteria judgment, summary quality, official-domain authenticity |

L2 failures print a table of `file → rule → detail` and exit non-zero.

## 3. Build artifacts (derived, never hand-edited)

`astro build` produces, from the single source of truth:

1. **Pages** — `/apps/<slug>` ×2 locales, category pages, grid, welcome.
2. **`/search-index.json`** — serialized MiniSearch index built in
   `search-index.json.ts`: for each app, `id` (slug), `name`,
   `nameNorm`, `summaryEnNorm`, `summaryViNorm`, `tagsNorm`, plus stored
   display fields (docs/05 §A2). Normalization happens at build so the
   client ships no extra work.
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
  "$schema": "softharbor-export-v1",
  "generatedAt": "2026-07-15T00:00:00Z",
  "count": 30,
  "license": "CC-BY-SA-4.0",
  "attribution": "SoftHarbor contributors — https://github.com/poli0981/softharbor",
  "apps": [ { /* exactly the schema of docs/04 §2, plus "slug" */ } ]
}
```

Breaking changes to this shape require a `$schema` bump and a decision-log
entry.

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
