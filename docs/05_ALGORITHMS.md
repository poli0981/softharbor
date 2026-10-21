# 05 — Algorithms

## A1 — Vietnamese-insensitive normalizer

The single most important 15 lines in the codebase: it makes
`trinh duyet` match `trình duyệt` and `Dinh Vu` match `Đình Vũ`.

```ts
// src/lib/normalize.ts
/** Lowercase, strip Vietnamese diacritics, fold đ/Đ, collapse whitespace. */
export function normalizeViet(input: string): string {
  return input
    .normalize('NFD')                 // decompose: ệ → e + ◌̂ + ◌̣
    .replace(/[\u0300-\u036f]/g, '')  // strip combining marks
    .replace(/đ/g, 'd')               // NFD does NOT decompose đ/Đ —
    .replace(/Đ/g, 'D')               // must fold explicitly
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
```

**Why NFD first:** input arrives in mixed forms — Vietnamese IMEs and mobile
keyboards emit precomposed NFC (`ệ` = U+1EC7) while some sources emit
decomposed sequences. `normalize('NFD')` unifies both before stripping.

**Test vectors (must all pass — spike S2):**

| input | expected |
|---|---|
| `Trình duyệt` | `trinh duyet` |
| `TRÌNH DUYỆT` (NFC) | `trinh duyet` |
| `Trình duyệt` typed as decomposed NFD | `trinh duyet` |
| `Đồ hoạ  &  Thiết kế` | `do hoa & thiet ke` |
| `đĐ` | `dd` |
| `7-Zip` | `7-zip` |
| `Ứng dụng` | `ung dung` |

Applied at **build time** to index fields and at **query time** via
MiniSearch's `processTerm` — the same function on both sides, imported from
one module (never duplicated). The same fold keys the name sort
(`compareNames`, §A3). The one deliberate copy lives in
`scripts/validate-data.mjs`, which runs in plain Node and cannot import from
`src/`; it is used only to catch duplicate names (docs/03 §2).

## A2 — Search index & query (MiniSearch)

```ts
// src/lib/searchOptions.ts — shared verbatim by the build-time indexer
// (search.ts → search-index.json.ts) and the client loader (searchIndex.ts).
// Deliberately free of any `minisearch` import (see below).
import { normalizeViet } from './normalize';

export const FUZZY = 0.25;                       // D22 — measured, see below

export const miniSearchOptions = {
  idField: 'slug',
  fields: ['name', 'tags', 'summaryEn', 'summaryVi'],   // raw values, not pre-normalized
  // No storeFields: MiniSearch already returns the id on every result, and
  // display data is in the DOM (A3). Storing anything here just inflates
  // /search-index.json.
  extractField: (doc: Record<string, unknown>, field: string): string => {
    const v = doc[field];
    return Array.isArray(v) ? v.join(' ') : ((v as string | undefined) ?? '');
  },
  processTerm: (t: string): string | null => {
    const n = normalizeViet(t);
    return n.length > 0 ? n : null;              // null drops the term
  },
  searchOptions: {
    prefix: true,
    fuzzy: FUZZY,
    boost: { name: 3, tags: 2, summaryEn: 1, summaryVi: 1 },
    combineWith: 'AND' as const,
  },
} as const;
```

- Fields are indexed **raw**. `processTerm` is what normalizes, and MiniSearch
  runs it on *both* sides — once per term at `addAll` time (so the serialized
  index on disk is already normalized) and once per query term. That is
  exactly A1's "same function on both sides, imported from one module". Do not
  add pre-normalized `nameNorm`/`summaryEnNorm` copies: they would double the
  index and give `boost` two sets of keys to disagree about.
- Index is built in `src/pages/search-index.json.ts` at build time
  (`buildIndex()` in `src/lib/search.ts`: `addAll` over the collection →
  `JSON.stringify`), then `MiniSearch.loadJSON` on the client — zero
  client-side indexing cost.
- **Client loader** (`src/lib/searchIndex.ts`): on the first focus or
  keystroke it fetches `/search-index.json` **and** pulls MiniSearch in with
  a dynamic `import('minisearch')` — the library used to ship in `/apps`'
  static bundle. One promise per page, shared by every caller, so a burst of
  keystrokes costs one download. A non-OK response or a failed import
  rejects, clears the cached promise (the next keystroke retries) and puts
  the island in an error state: "Search is unavailable right now — the
  filters still work" (`search.error`). The facets never depend on the index
  (A3).
- **Query flow** (`ShSearch.svelte`): input is debounced **150 ms**, then
  the trimmed query goes to `query` and a **sequence number** is taken; a
  result that arrives after a newer query (or after the box was emptied) is
  dropped, so a late index can never filter the grid behind an empty box.
  The hits, in MiniSearch's rank order, go to the grid controller (A3).
  A subtle "loading" label shows while the fetch is in flight.
- **Relevance order.** While a query is active the sort switches from A–Z
  to "Best match" (`relevance`) — unless the visitor has picked an order
  themselves; emptying the query switches back.
- Empty query ⇒ the search layer constrains nothing (`setSearchHits(null)`),
  i.e. *all* slugs pass through to A3. Esc clears the box first, then blurs.

**`fuzzy = 0.25` — settled by measurement in S2 (2026-07-27), decision D22.**
MiniSearch converts the fraction to `round(term.length × fuzzy)` edits. The
sweep over the fixture set:

| fuzzy | `gmip` | `gimo` | `fierfox` | `archiver` | `gimp` |
|---|---|---|---|---|---|
| 0.15 | — | gimp | — | 7-zip | gimp |
| **0.25** | — | **gimp** | **firefox** | **7-zip** | **gimp** |
| 0.375 | gimp, 7-zip | gimp, firefox | firefox | 7-zip | **gimp, 7-zip** |
| 0.6 | gimp, 7-zip | gimp, firefox | firefox | 7-zip, brave, gimp | gimp, 7-zip |

The old spec demanded `gmip` → GIMP. That is a transposition — 2 edits on a
4-character term — so it needs `fuzzy ≥ 0.375`, and the same row shows the
price: at 0.375 the **correctly spelled** query `gimp` also returns 7-Zip.
Two edits on a four-letter word matches a large slice of any dictionary, so
precision collapses exactly where the user is most sure they typed it right.

0.25 is the knee: 1 edit on short terms, 2 on terms of 6+ characters. It
catches realistic typos (`gimo`, `fierfox`) while exact queries stay exact.
**The `gmip` vector was retired** (docs/11 §2) rather than paying for it.
`src/lib/search.test.ts` pins both directions — the typos that must match and
the exact queries that must not blur — so nobody "fixes" a future fuzzy miss
by turning the constant up.

## A3 — Filter & sort composition

State (nanostores, `src/lib/stores.ts`): `query`, `categories: Set`,
`platforms: Set`, `pricing: Set`, `sort: 'name' | 'added' | 'relevance'`,
plus `visibleCount` (written by the grid, read by the filter sheet's "Show N
apps"). `clearAll()` empties the query **and** every facet — before v1.1
"Clear all" reset the facets while the box kept its text and the grid stayed
filtered by it. The atoms live for one page: every navigation is a full
document load (docs/02 §6), and the URL is the durable copy (below).

**Export the atoms WITHOUT the `$` prefix** that nanostores' own docs use.
Svelte reserves `$` for store auto-subscription, so `import { $query }` in a
`.svelte` file is a hard compile error (`dollar_prefix_invalid`) — and it is
precisely by naming the export `query` that a component can write `$query` to
read it reactively. The two conventions collide head-on and nanostores is the
side that gives (found in M3).

**Where the logic lives.** The composition and sort below are pure functions in
`src/lib/filter.ts`, unit-tested without a DOM. `src/lib/grid.ts` is the thin
layer that reads the `data-*` facets off the cards, toggles `hidden` and
reorders the card nodes. Neither is an island: docs/02 §5 fixes the count at
six, so `ShSearch` mounts the grid controller rather than a seventh island
existing.

Reordering uses **real DOM moves** (`insertBefore`, walking the desired
order against the live child list so an unchanged order costs zero writes)
and never `el.style.*`. An earlier version set `el.style.order`, which CSP
`style-src` silently refuses — sorting was broken in production while every
build gate passed (2026-07-30, docs/15 §4). DOM moves also keep tab order
equal to visual order; nothing is lost, because cards carry no entrance
animation and every control that drives the grid lives outside it.

**Where the facet data comes from.** Every card wrapper is server-rendered
with `data-slug`, `data-name`, `data-categories`, `data-platforms`,
`data-pricing`, `data-added` (docs/06 §6). The grid controller reads those
attributes and nothing else. This matters: `/search-index.json` is
lazy-loaded on first search interaction, so filtering and sorting **must not
depend on it** — a user who only clicks facets never triggers that fetch,
and one who filters before the index lands must still get correct results.

```
visible = searchResults(query)                 // A2, or ALL if query empty
        ∩ (categories empty ? ALL : app.categories ∩ selected ≠ ∅)
        ∩ (platforms  empty ? ALL : app.platforms  ∩ selected ≠ ∅)
        ∩ (pricing    empty ? ALL : app.pricing ∈ selected)
sorted: name      → compareNames(a.name, b.name)
        added     → addedAt desc, tiebreak compareNames
        relevance → MiniSearch rank; unranked cards fall back to compareNames
```

**`compareNames`** is `Intl.Collator('en', { sensitivity: 'base', numeric:
true })` over `normalizeViet(name)` (keys cached per name). It is THE name
order wherever a list is sorted by name — the grid, category pages
(`byAddedDesc` in `src/lib/paths.ts`) and the detail page's "More in
<category>" — so they cannot disagree. Pinned to `en` on purpose: a bare
`localeCompare()` collates by the visitor's browser locale (a Czech browser
moved 81 of 326 cards, because "ch" sorts after "h" there) or, at build time,
by whatever ICU default the build machine has. `numeric` puts "7-Zip" before
"10…". The server renders `/apps` in the same A–Z order, so hydration never
reshuffles the grid.

Semantics: **OR within a facet, AND across facets** (industry-standard
faceting). The grid is fully server-rendered; filtering toggles `hidden` on
card wrappers via slug lookup — no client re-render of card content, so
disabled-JS users still see everything (docs/03 §8).

**Result count.** `#sh-count` is server-rendered with the true total and
announced via `aria-live="polite"`. It carries one template per plural
category (`data-count-one`, `data-count-other`); the controller picks with
`Intl.PluralRules(<html lang>)` and formats the number with
`Intl.NumberFormat`, and writes only when the text changed (identical text in
a live region is re-announced). The empty state (`#sh-empty`) is revealed
only once filtering really yields nothing, never while the index loads.

**View state in the URL** (`src/lib/urlstate.ts`, v1.1). The view
round-trips through the query string, so it can be shared, survives a reload
and Back, and follows a language switch (`ShLangSwitch` carries
`location.search` + `location.hash`):

```
/apps?q=trinh+duyet&cat=browser,utilities&platform=linux&pricing=free&sort=added
```

- `ShSearch` parses it when it mounts (`client:idle`, so a shared link
  first paints the full grid, then narrows); writes go through
  `history.replaceState` **300 ms** after the view stops changing — no
  history entry per keystroke.
- Facet values must look like slugs (`^[a-z0-9]+(?:-[a-z0-9]+)*$`); anything
  else is noise and dropped. Lists are de-duplicated and written in a stable
  order; `q` is trimmed and capped at 200 characters.
- `sort` is written only when the visitor chose it and it is not the
  default `name`; an automatic "Best match" order is implied by `q`.
- `#search` on `/apps` focuses the search box — the welcome page's search
  field and the header's search hint are links to it.

## A4 — Feed generation

`/rss.xml`: all apps sorted `addedAt` desc, take 50. `guid = slug`
(`isPermaLink=false`), `pubDate = addedAt T00:00:00Z`. Deterministic: same
data ⇒ byte-identical feed, so `notify.py` cron never double-fires on
redeploys without data changes.

Two implementation notes from M5:

- **`@astrojs/rss` has no `guid` option** — it derives `<guid>` from `link`.
  The bare slug with `isPermaLink="false"` has to be injected via
  `customData`. Verified in the emitted XML that this produces exactly one
  `<guid>`, not two.
- **Same-day ties break by name** (`src/lib/feed.ts`). Not cosmetic: ordering
  must be a function of the data alone, or two entries added on the same day
  could swap places between builds and be re-announced. Determinism is
  asserted by building twice and comparing hashes — `/rss.xml` is byte-
  identical, while `/api/apps.json` legitimately differs because
  `generatedAt` is a build timestamp (docs/03 §6).
- **The tie-break collator is pinned** — `Intl.Collator('en')`, not a bare
  `localeCompare()`. Builds run on Workers Builds, GitHub runners and
  laptops; if two machines' ICU defaults disagreed, the 50-item window could
  change membership between builds and notify.py would announce apps that
  are not new. `en` matches the order production served at launch (checked
  byte-for-byte against the live feed). `/api/apps.json` is likewise sorted
  by slug in code-unit order, independent of the build machine.

**`scripts/check-feed.mjs`** (in `pnpm build` since v1.1) asserts what was
actually **emitted**, because the guid is injected through `customData` — a
seam no unit test sees and a dependency update could break with every test
green: 1–50 items; exactly one `<guid isPermaLink="false">` per item holding
the slug of an app that exists in `src/data/apps/`; guids unique; `<link>`
is that app's page; `<pubDate>` parses and items run newest first.

## A5 — Console ring buffer

```js
// src/scripts/errors.js — plain classic script (abridged)
(() => {
  var CAP = 20, MAX_LINE = 500;
  var buf = (window.__shErrors = window.__shErrors || []);
  var seen = Object.create(null);          // one line per distinct failure
  function push(line) {
    var key = line.slice(0, 200);
    if (seen[key]) return;
    seen[key] = true;
    buf.push(('[' + new Date().toISOString() + '] ' + location.pathname +
              ' ' + line).slice(0, MAX_LINE));
    if (buf.length > CAP) buf.shift();
  }
  // error (own-origin scripts only) · unhandledrejection (first two stack
  // lines) · securitypolicyviolation · astro:hydration-error
  …
})();
```

**The buffer cannot live in the island.** `ShBugReport` is `client:visible` in
the footer (docs/02 §5), so listeners attached at hydration would miss every
error that happened before the user scrolled — which is most of them, and
exactly the ones a bug report is about. The listeners therefore ship in
`src/scripts/errors.js`, and the two halves meet on `window.__shErrors`;
`src/lib/ringbuffer.ts` is only the reader (`getBuffer()`, `bufferSize()`).

**Loaded first, blocking.** `errors.js` is the first script in `<head>`,
before `theme.js` and any island bootstrap — until v1.1 it was `defer`red,
so it missed exactly the early failures a report needs. `Base.astro`
imports it with `?url&no-inline`: a content-hashed, immutable `/_astro/`
file covered by `script-src 'self'` with no hash (docs/09 §4).

What it records, each line stamped with time and page path and
de-duplicated so a failure in a loop cannot flush the rest:

- uncaught errors from **our own origin** — extension and third-party
  script errors are skipped: not our bugs, and their URLs would reveal which
  extensions a visitor runs;
- unhandled promise rejections;
- **CSP violations** (`securitypolicyviolation`). The policy is a `<meta>`
  tag, which cannot carry `report-uri`/`report-to`, so this event is the
  only place a refused script or style ever surfaces;
- island hydration failures, which Astro catches and re-dispatches as
  `astro:hydration-error` instead of letting them reach `window.onerror`.

The footer link shows the count ("3 errors") when the buffer is non-empty.

Privacy: in-memory only, for the life of the page; never wraps `console.*`,
never touches input values, and nothing leaves the page unless the visitor
opens a bug report (A6).

## A6 — Bug-report URL builder

GitHub Issue Forms prefill fields via query params matching each field `id`
in `bug_report.yml` (docs/12 §7).

```ts
// src/lib/issueUrl.ts
const REPO = 'https://github.com/poli0981/softharbor';
export const BUDGET = 5000;   // total-URL budget, measured by spike S3 (below)

export function buildBugUrl(consoleText: string, context?: BugContext): string {
  const ctx = context ?? currentContext();   // { href, userAgent, lang }
  const u = new URL(`${REPO}/issues/new`);
  u.searchParams.set('template', 'bug_report.yml');
  u.searchParams.set('labels', 'bug');
  u.searchParams.set('page-url', ctx.href);
  u.searchParams.set('environment', `${ctx.userAgent} · lang=${ctx.lang}`);
  // Newest lines matter most, so truncate from the head — measured on the
  // REAL encoded URL, not an estimate.
  let logs = consoleText;
  const withLogs = (s: string) => {
    const probe = new URL(u.toString());
    probe.searchParams.set('console-output', s || '(buffer empty)');
    return probe.toString();
  };
  while (logs.length > 0 && withLogs(logs).length > BUDGET) {
    const nl = logs.indexOf('\n');
    logs = nl === -1 ? '' : logs.slice(nl + 1);
  }
  u.searchParams.set('console-output', logs || '(buffer empty)');
  return u.toString();
}
```

`ShBugReport` rebuilds the URL on hover, focus and click — it embeds the
*current* page and buffer — and renders a real `<a target="_blank">`, so the
visitor can see, copy or middle-click the target. Opening it sends the
prefilled fields to GitHub as URL parameters; nothing is filed until the
visitor submits the form (docs/09 §8).

**`BUDGET = 5000`** — measured by spike S3 against github.com (2026-07-27,
two probes per length):

| Total URL length | GitHub response |
|---|---|
| ≤ 6 660 | `302` — accepted |
| 7 160 – 7 960 | **`500` Internal Server Error** |
| ~8 160 | connection reset |
| ≥ 8 360 | `414` URI Too Long |

The important part is the *shape*: GitHub does not degrade gracefully into a
414. There is a ~1.3 KB band where it plainly 500s, and the only person who
ever meets it is a user who just clicked "Report a bug" — the worst possible
moment for an error page. So the budget sits **~25 % below the first observed
failure (6 660)**, not at 80 % of the hard 414 limit: 80 % of 8 360 is 6 688,
which lands inside the 500 band. Re-measure if GitHub changes; the constant is
an observation, not a standard.

## A7 — Legal-gate version check

```ts
// src/lib/legal.ts (abridged)
/** Version of the ACCEPTED set — bump when one of those three changes. */
export const LEGAL_VERSION = '2026-10-21';
export const ACCEPTED_DOCS = ['disclaimer', 'privacy', 'terms'] as const;
/** Each document's own "Last updated" (docs/14 Part 2). */
export const LEGAL_UPDATED: Readonly<Record<LegalDoc, string>> = { /* six dates */ };

const KEY = 'sh:legal';
const MEM_KEY = '__shLegalAcceptedThisSession';   // on globalThis

export function isAccepted(): boolean {
  if (globalThis[MEM_KEY] === true) return true;
  try { return localStorage.getItem(KEY) === LEGAL_VERSION; }
  catch { return false; }
}
export function acceptLegal(): void {
  globalThis[MEM_KEY] = true;
  try { localStorage.setItem(KEY, LEGAL_VERSION); } catch { /* memory carries it */ }
}
```

Any value ≠ current version re-opens the gate — old versions, *newer*
versions and garbage alike: equality, never `startsWith`, never ordering.
localStorage failures (private mode with storage disabled) fail open *per
session*: the gate shows once and acceptance is held in memory. The memory
flag lives on `globalThis`, not in a module-local `let`, because its real
scope is the session — a module-local also leaked acceptance between tests.

**Exemptions are declared by the page**, not computed from the path: a page
passes `gateExempt` to `Base.astro` and the island is simply not rendered
(legal documents, contact, 404, offline, error templates — docs/14 Part 2).
The old path regex never matched the cases that mattered: Workers serves
`404.html` at whatever URL was requested, and the service worker serves the
offline page at the URL that failed.

Version policy (bump rule, per-document dates, the test that enforces it):
docs/14 Part 2. The gate's second step — the human check — is §A9.

## A8 — Theme resolution (no-flash)

`src/scripts/theme.js` — a real file, **not** inline, loaded by a *blocking*
classic `<script src>` in `<head>` (no `defer`, no `async`, no
`type=module`), right after `errors.js` and before any stylesheet-dependent
paint. `Base.astro` imports it with `?url&no-inline`, so Vite copies it
verbatim to a content-hashed `/_astro/theme.<hash>.js`, cached immutably and
covered by `script-src 'self'` without a hash (docs/09 §4). (Until v1.1 it
was `public/theme.js` at a fixed path with a revalidating cache.)

```js
// src/scripts/theme.js — plain classic script (abridged)
(() => {
  const read = (key) => { try { return localStorage.getItem(key); }
                          catch { return null; } };   // storage may THROW
  const root = document.documentElement;
  const theme = read('sh:theme');                       // 'light'|'dark'|null
  const explicit = theme === 'light' || theme === 'dark' ? theme : null;
  const dark = explicit ? explicit === 'dark'
                        : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'dark' : 'light';
  const scrollbar = read('sh:scrollbar');               // 'thin'|'hidden'|null
  if (scrollbar === 'thin' || scrollbar === 'hidden') root.dataset.scrollbar = scrollbar;
  if (read('sh:motion') === 'reduce') root.dataset.motion = 'reduce';
  // + marks View Transition promises handled on pageswap/pagereveal
})();
```

A render-blocking same-origin script in `<head>` runs before first paint just
as an inline one does, so there is no flash of the wrong theme, scrollbar or
motion — the cost is one request, cached immutably. Storage reads are
guarded: with site data blocked localStorage *throws*, and an unguarded read
used to abort the script and leave dark-OS visitors on the light theme.
Unknown or garbage values mean "the default". With scripting off there is no
`data-theme` at all and the CSS's `prefers-color-scheme` block applies — kept
identical to the dark theme by test (docs/06 §2).

**The display menu (`ShPrefs`, v1.1)** replaced `ShThemeToggle`: one icon
button opens a popover (`popover="auto"`) with three radio groups.

| Choice | Values | Storage | Applied as |
|---|---|---|---|
| Theme | system · light · dark | `sh:theme` (key removed for system) | `html[data-theme]` |
| Scrollbar | default · thin · hidden | `sh:scrollbar` (removed for default) | `html[data-scrollbar]` |
| Motion | system · reduce | `sh:motion` (removed for system) | `html[data-motion]` |

- While the theme is `system` it follows the OS live (`change` on the
  media query); an explicit choice stops that.
- A `storage` event from another tab re-applies the changed preference here.
- "Hidden" removes the scrollbar, never the scrolling; under forced colours
  the bar is handed back to the system.
- The rules are written twice — typed in `src/lib/theme.ts` /
  `src/lib/prefs.ts` for the island, plain in `theme.js` for pre-paint (it
  ships unbundled and cannot import). `prefs.test.ts` runs the real script
  to keep the two identical.
- The same island owns the global **`/` shortcut** off `/apps`: it goes to
  `/apps#search` (on `/apps` `ShSearch` focuses its own box). It never fires
  inside a text field or while the legal gate is open
  (`body[data-sh-gate="open"]`, docs/06 §9).

## A9 — Gate step 2: the human check (`sh:human`)

The browser half of D25 (`src/lib/turnstile.ts`, `src/lib/human.ts`; the
server half and its threat model are docs/09 §4a).

```
gate mounts ─▶ !isAccepted()            → step 1 (documents) ─ accept ─┐
            ─▶ accepted ∧ !isHuman()    → step 2 directly              │
            ─▶ accepted ∧ isHuman()     → closed                       │
                                                                        ▼
step 2: load api.js (once) ─▶ render Managed widget ─▶ token ─▶ POST /api/verify
          200          → rememberHuman(48 h) → close
          anything else→ rememberHuman(1 h)  → "check skipped" (1.5 s) → close
```

- **Never before acceptance.** `api.js` is injected only when step 2
  starts — the documents describing Turnstile are accepted first. One
  injection per page, shared by concurrent callers; a failed load is
  forgotten so a later attempt can retry.
- **Widget:** `sitekey` `0x4AAAAAAFfEB-RvBz18M-UK` (public by design);
  Cloudflare's always-pass test sitekey on `localhost`, `127.0.0.1` and
  `[::1]`. `action: 'legal_gate'` (must equal the Worker's), `appearance:
  'interaction-only'` (most people never see it), the page's theme and
  language, `retry: 'never'`, `response-field: false` (no form — the token
  travels in our own JSON body).
- **Timeouts:** 10 s for the whole check; once the widget asks for a click
  (`before-interactive-callback`) the person gets 120 s instead. The POST
  itself times out after 8 s.
- **Retries:** a `403` (token rejected — spent, stale, minted elsewhere) is
  answered with a fresh challenge (`reset`), up to 3 attempts. `429`, `503`,
  a network failure, a widget error, "unsupported" or a timeout all resolve
  to *unverified* at once. Every path resolves exactly once; none throws.
- **`sh:human`** stores an **expiry timestamp** (ms), so the lifetime is
  decided when the check ends: `PASS_TTL_MS` = 48 h after a pass,
  `UNVERIFIED_TTL_MS` = 1 h after the gate let someone through unchecked —
  short enough that an outage is retried soon, long enough not to ask on
  every page. `isHuman()` rejects values further out than 48 h (not written
  by us), garbage and the past. Storage failures fall back to a
  `globalThis` copy for the page, like §A7.
- A returning visitor whose check has lapsed sees step 2 only; the
  documents are not re-shown unless `LEGAL_VERSION` changed.
