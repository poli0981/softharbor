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
 review → squash-merge (signed) → Workers Builds deploy → verify production
                                                    (docs/13 §3) → live
```

Rules: one app per PR; PR title `data: add <slug>`; summaries written from
scratch in both EN and VI (hard rule 8); `security.checkedAt` set to the
review date after the maintainer runs the vetting checklist (docs/09 §6).

## 2. Validation layers

| Layer | Where | Catches |
|---|---|---|
| L1 Zod schema | `src/content.config.ts`, runs inside `astro build` | Types, enums, https-only URLs, summary lengths; dates must be **real calendar dates** (`2026-02-31` fails) **not in the future**; `updatedAt ≥ addedAt`; **`evidence` required for `clean` and `flagged`**; unknown keys (`.strict()`) — docs/04 §1 |
| L2 `scripts/validate-data.mjs` | first step of `pnpm build`; CI (`ci.yml` job `gates`) + pre-commit | Cross-file and provenance rules Zod can't see, listed below |
| L2b `scripts/check-i18n-parity.mjs` | second step of `pnpm build`; CI (`ci.yml` job `gates`) + pre-commit | EN/VI dictionary key parity, placeholder parity, alphabetical order (docs/07 §3) — a **separate** script and a separate `pnpm i18n:check`, because it is triggered by `src/i18n/**`, not `src/data/**` |
| L3 lychee link check | CI (PR: changed files only; weekly: all) | Dead official links; 403/429 count as reachable (bot mitigation, docs/12 §5) |
| L4 Human review | PR review | Criteria judgment, summary quality, official-domain authenticity |

**L2 rules** (`file → rule → detail`; each is a fixture test in
`scripts/validate-data.test.ts`):

| Rule | Fails when |
|---|---|
| `slug-format` / `slug-length` | filename is not `^[a-z0-9]+(-[a-z0-9]+)*$`, or longer than 40 chars (docs/04 §2 — Zod never sees the filename; duplicate slugs cannot exist in one directory) |
| `duplicate-name` | two `name`s collide after `normalizeViet` (case- and diacritic-insensitive) |
| `unknown-category` | a `categories[]` id is not in `categories.json` |
| `bad-url` / `insecure-link` | a `links.*` or `security.evidence` value does not parse, or is not https |
| `punycode-host` | any host label starts with `xn--` — check for a look-alike |
| `download-portal` | the host is (or is under) a denylisted portal/mirror: softpedia, filehorse, uptodown, download.cnet, majorgeeks, filehippo, softonic, fosshub, techspot, malavida, chip.de, portableapps, apkmirror, getintopc |
| `tracking-param` | a query key is `utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `mc_eid`, `ref`, `aff`, `affiliate` or `partner` |
| `invisible-char` | any string value contains a zero-width or bidi-control character |
| `flagged-in-main-tree` | `security.status` is `flagged` inside `src/data/apps/` — run `pnpm quarantine` (§5) |
| `missing-logo` | a `local:` logo is not in `src/assets/logos/` — compared against the directory listing, **case-sensitively** (Windows would accept a wrong case that Linux CI and Workers Builds reject) |
| `future-date` / `date-order` | `addedAt`, `updatedAt` or `checkedAt` after today; `updatedAt` before `addedAt` |
| `unflagged-in-quarantine` / `slug-in-both-trees` | a file in `data/quarantine/` no longer says `flagged`, or the same slug is live and quarantined |
| `stale-check` (**warning**) | `security.checkedAt` older than 180 days — re-verify (docs/13 §6); grouped, never fails the build |

Both L2 scripts are plain Node (`fs` + `JSON.parse`) — they run **outside**
Astro and must never import from `astro:content`. Failures print a table of
`file → rule → detail` and exit non-zero. Port the structure from
`E:\qoute\scripts\validate-data.ts` and `check-i18n-parity.ts`, which already
implement exactly this contract.

## 3. Build artifacts (derived, never hand-edited)

`astro build` produces, from the single source of truth (701 HTML pages as
of 2026-10-21; `pnpm build` then checks the output — docs/02 §4):

1. **Pages** — `/apps/<slug>` ×2 locales, category index + category pages,
   grid, welcome, contact, the six legal documents (the third-party table
   generated from `package.json` at build time, docs/14 §3e), 404/offline
   and the dormant error templates.
2. **`/search-index.json`** — serialized MiniSearch index built in
   `search-index.json.ts`: for each app, `slug` (the id) plus the **raw**
   `name`, `tags`, `summaryEn`, `summaryVi` (docs/05 §A2). There are no
   pre-normalized `*Norm` fields: normalization is `processTerm`'s job, and
   MiniSearch applies it on **both** sides — at `addAll` time (so the
   serialized index on disk is already normalized) and to each query term.
   One function, one import, no duplicated logic (docs/05 §A1). Display data
   is **not** stored in the index — it is already in the DOM (docs/05 §A3).
3. **`/api/apps.json`** — full public dataset export (§6).
4. **`/rss.xml`** — 50 newest by `addedAt` (§7), its emitted guids, links
   and order asserted by `check:feed`.
5. **Sitemap** with hreflang pairs (docs/07 §6).

## 4. Update & re-verification flow

- Editing an app = PR touching its one file; bump `updatedAt`.
- Re-checks are automated since 2026-10-23 (docs/12 §4b): `vt-recheck.yml`
  re-scans every entry whose `checkedAt` is older than 90 days, a few
  hundred requests a day within VirusTotal's Public API limits, into one
  accumulating PR. It refreshes `checkedAt` even when nothing changed — the
  dated status is the product's honesty mechanism — and turns any detection
  into `unverified` plus an issue, never into a flag.

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
                     ▼  `pnpm quarantine` in the same PR — or, as the
                     ▼  safety net, the quarantine workflow (docs/12 §4)
   file moved  src/data/apps/x.json → data/quarantine/x.json
   + issue opened: reason, evidence link, date
   + merge → deploy → app disappears (verify production, docs/13 §3)
                     │
        cleared? reviewed restore PR (status back to clean/unverified,
        new checkedAt, evidence) → file moves back
```

Invariants: `data/quarantine/` is outside the content glob, so quarantined
entries can never render; the *reason* lives in the issue + commit message,
keeping the data file schema-identical for painless restore; deletion of a
data file is only allowed for entries that never shipped. `validate:data`
enforces both directions — a `flagged` file may not stay in
`src/data/apps/`, a quarantined file must still say `flagged`, and one slug
may not live in both trees (§2) — so a PR that flags an entry fails until
`pnpm quarantine` has moved it. The directory itself appears with the first
quarantined entry. A flagged entry vanishes from all five surfaces: detail
page, grid, `/api/apps.json`, `/rss.xml` and the search index (tested
end-to-end 2026-07-28).

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
plus `slug`, with `categories` as plain ids. Because the collection schema is
`.strict()`, the export shape cannot silently grow. Breaking changes require
a `schemaVersion` bump and a decision-log entry. `apps` is sorted by slug in
code-unit order — a stable document whatever machine builds it (docs/05
§A4). Served with `Access-Control-Allow-Origin: *` and a 300 s cache
(docs/09 §4).

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
docs/13 §5). It announces every guid it has not seen, so `check:feed`
asserts the emitted guids, links and order on every build (docs/05 §A4).
Tagged releases are announced separately, Discord only, by `notify.yml`
(docs/12 §2).

## 8. Client-side flow

```
first paint: static HTML (grid server-rendered with ALL apps, A–Z)
   ├─ <head>: errors.js (ring buffer, first) → theme.js (pre-paint prefs)
   │          → registerSW.js, analytics.js (defer)
   └─ ShSearch hydrates on idle → restores ?q&cat&platform&pricing&sort
        └─ on first focus/keystroke: fetch /search-index.json
           + import('minisearch') — one shared promise per page
             └─ MiniSearch.loadJSON → ranked hits → grid controller
                  └─ cards toggle `hidden` and move in the DOM (no
                     re-render of content); the URL follows (replaceState)
errors anywhere: own-origin errors, unhandled rejections, CSP violations,
   hydration errors → ring buffer (A5)
   └─ ShBugReport builds prefilled GitHub issue URL (A6)
```

Graceful degradation: with JS disabled, the full grid, category pages, and
all links still work; search, filters, the display menu and the legal gate
(all islands) do not run. Dark mode still follows the OS — the CSS's
`prefers-color-scheme` block needs no script (docs/06 §2) — and the header's
search hint and EN/VI links are plain links.
