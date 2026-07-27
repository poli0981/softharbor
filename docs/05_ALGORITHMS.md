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
  fields: ['name', 'tags', 'summaryEn', 'summaryVi'],
  storeFields: ['slug'],                     // display data stays in the DOM
  processTerm: (t: string) => {
    const n = normalizeViet(t);
    return n.length > 0 ? n : null;
  },
  searchOptions: {
    prefix: true,
    fuzzy: 0.15,
    boost: { name: 3, tags: 2, summaryEn: 1, summaryVi: 1 },
    combineWith: 'AND',
  },
} as const;
```

- Index is built in `src/pages/search-index.json.ts` at build time
  (`MiniSearch.addAll` over the collection → `JSON.stringify(mini)`), then
  `MiniSearch.loadJSON` on the client — zero client-side indexing cost.
- Lazy-load on first focus/keystroke of the search input; show a subtle
  "loading index…" state for the (rare) slow fetch.
- Empty query ⇒ search layer passes *all* slugs through to A3.

## A3 — Filter & sort composition

State (nanostores, `src/lib/stores.ts`): `query`, `categories: Set`,
`platforms: Set`, `pricing: Set`, `sort: 'name' | 'added'`.

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

`BUDGET` is an empirical constant — spike S3 binary-searches the real limit
on github.com and sets it with ~20 % headroom.

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

Inline `<head>` script (hashed for CSP, docs/09 §4):

```js
(() => {
  const s = localStorage.getItem('sh:theme');              // 'light'|'dark'|null
  const dark = s ? s === 'dark'
                 : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
```

`ShThemeToggle` cycles system → light → dark (writes/clears `sh:theme`) and
keeps `data-theme` in sync with a `change` listener on the media query while
in system mode.
