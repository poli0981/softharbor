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
one module (never duplicated).

## A2 — Search index & query (MiniSearch)

```ts
// src/lib/search.ts
import MiniSearch from 'minisearch';
import { normalizeViet } from './normalize';

export const miniSearchOptions = {
  idField: 'slug',
  fields: ['name', 'tags', 'summaryEn', 'summaryVi'],   // raw values, not pre-normalized
  // No storeFields: MiniSearch already returns the id on every result, and
  // display data is in the DOM (A3). Storing anything here just inflates
  // /search-index.json.
  extractField: (doc, field) => {
    const v = doc[field];
    return Array.isArray(v) ? v.join(' ') : v;   // `tags` is string[] — be explicit
  },
  processTerm: (t: string) => {
    const n = normalizeViet(t);
    return n.length > 0 ? n : null;              // null drops the term
  },
  searchOptions: {
    prefix: true,
    fuzzy: 0.15,          // PROVISIONAL — S2 sets the real value, see below
    boost: { name: 3, tags: 2, summaryEn: 1, summaryVi: 1 },
    combineWith: 'AND',
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
  (`MiniSearch.addAll` over the collection → `JSON.stringify(mini)`), then
  `MiniSearch.loadJSON` on the client — zero client-side indexing cost.
- Lazy-load on first focus/keystroke of the search input; show a subtle
  "loading index…" state for the (rare) slow fetch.
- Empty query ⇒ search layer passes *all* slugs through to A3.

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
`platforms: Set`, `pricing: Set`, `sort: 'name' | 'added'`.

**Export the atoms WITHOUT the `$` prefix** that nanostores' own docs use.
Svelte reserves `$` for store auto-subscription, so `import { $query }` in a
`.svelte` file is a hard compile error (`dollar_prefix_invalid`) — and it is
precisely by naming the export `query` that a component can write `$query` to
read it reactively. The two conventions collide head-on and nanostores is the
side that gives (found in M3).

**Where the logic lives.** The composition and sort below are pure functions in
`src/lib/filter.ts`, unit-tested without a DOM. `src/lib/grid.ts` is the thin
layer that reads the `data-*` facets off the cards and writes `hidden` /
`order`. Neither is an island: docs/02 §5 fixes the count at six, so
`ShSearch` mounts the grid controller rather than a seventh island existing.

Reordering uses **CSS `order`, not DOM moves** — moving nodes on every
keystroke would drop focus and restart the entrance animation.

**Where the facet data comes from.** Every card wrapper is server-rendered
with `data-slug`, `data-categories`, `data-platforms`, `data-pricing`,
`data-added` (docs/06 §6). The filter island reads those attributes and
nothing else. This matters: `/search-index.json` is lazy-loaded on first
search interaction, so filtering and sorting **must not depend on it** — a
user who only clicks facets never triggers that fetch, and one who filters
before the index lands must still get correct results.

```
visible = searchResults(query)                 // A2, or ALL if query empty
        ∩ (categories empty ? ALL : app.categories ∩ selected ≠ ∅)
        ∩ (platforms  empty ? ALL : app.platforms  ∩ selected ≠ ∅)
        ∩ (pricing    empty ? ALL : app.pricing ∈ selected)
sorted: name → localeCompare on normalizeViet(name)
        added → addedAt desc, tiebreak name
```

Semantics: **OR within a facet, AND across facets** (industry-standard
faceting). The grid is fully server-rendered; filtering toggles `hidden` on
card wrappers via slug lookup — no client re-render of card content, so
disabled-JS users still see everything (docs/03 §8). Result count is
announced via `aria-live="polite"`.

## A4 — Feed generation

`/rss.xml`: all apps sorted `addedAt` desc, take 50. `guid = slug`
(`isPermaLink=false`), `pubDate = addedAt T00:00:00Z`. Deterministic: same
data ⇒ byte-identical feed, so `notify.py` cron never double-fires on
redeploys without data changes.

## A5 — Console ring buffer

```ts
// src/lib/ringbuffer.ts — module-level singleton, ~30 LOC
const CAP = 20;
const buf: string[] = [];
function push(line: string) {
  buf.push(`[${new Date().toISOString()}] ${line}`.slice(0, 500));
  if (buf.length > CAP) buf.shift();
}
window.addEventListener('error', (e) =>
  push(`error: ${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) =>
  push(`unhandledrejection: ${String(e.reason).slice(0, 400)}`));
export const getBuffer = () => buf.join('\n');
```

Privacy: captures only exception text from our own origin; never wraps
`console.*`, never touches input values, never leaves the page until the
user explicitly opens a bug report (A6).

## A6 — Bug-report URL builder

GitHub Issue Forms prefill fields via query params matching each field `id`
in `bug_report.yml` (docs/12 §7).

```ts
// src/lib/issueUrl.ts
const REPO = 'https://github.com/poli0981/softharbor';
const BUDGET = 5500;   // conservative total-URL budget; verified by spike S3

export function buildBugUrl(consoleText: string): string {
  const u = new URL(`${REPO}/issues/new`);
  u.searchParams.set('template', 'bug_report.yml');
  u.searchParams.set('labels', 'bug');
  u.searchParams.set('page-url', location.href);
  u.searchParams.set('environment',
    `${navigator.userAgent} · lang=${document.documentElement.lang}`);
  // newest lines matter most → truncate from the head
  let logs = consoleText;
  const overhead = () => u.toString().length + encodeURIComponent(logs).length;
  while (logs.length > 0 && overhead() > BUDGET) {
    logs = logs.slice(logs.indexOf('\n') + 1 || logs.length);
  }
  u.searchParams.set('console-output', logs || '(buffer empty)');
  return u.toString();
}
```

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
export const LEGAL_VERSION = '2026-07-15';   // bump when any legal doc changes
const KEY = 'sh:legal';
export const isAccepted = () => localStorage.getItem(KEY) === LEGAL_VERSION;
export const accept     = () => localStorage.setItem(KEY, LEGAL_VERSION);
```

Any value ≠ current version (including old versions) re-opens the gate.
Route exemptions and dialog behavior: docs/14 §2. localStorage failures
(private mode with storage disabled) fail open *per session*: gate shows
once, acceptance held in memory.

## A8 — Theme resolution (no-flash)

`public/theme.js` — **not** inline. The strict CSP is `script-src 'self'` with
no hashes (docs/09 §4, decision D18), so this ships as a real file loaded by a
*blocking* tag in `<head>`, before any stylesheet-dependent paint:

```html
<script src="/theme.js"></script>   <!-- no defer, no async: must run pre-paint -->
```

```js
// public/theme.js — plain classic script, not a module (modules are deferred).
(() => {
  const s = localStorage.getItem('sh:theme');              // 'light'|'dark'|null
  const dark = s ? s === 'dark'
                 : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
```

A render-blocking same-origin script in `<head>` runs before first paint just
as an inline one does, so there is no theme flash — the only cost is one
request, which is cached and HTTP/2-multiplexed. This file lives in `public/`
(copied verbatim to `dist/`) so it is never bundled, hashed, or renamed; the
`<script src>` path is therefore stable.

`ShThemeToggle` cycles system → light → dark (writes/clears `sh:theme`) and
keeps `data-theme` in sync with a `change` listener on the media query while
in system mode.
