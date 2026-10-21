# 06 — UI Specification

## 1. Design direction

**"Harbor" (v1.1) — a harbour master's ledger.** Cool chart paper and navy
ink by day, a night harbour by night; one harbour-blue accent; hairline
rules, soft layered shadows, mono labels for the data, generous whitespace,
and type doing the personality work. The welcome hero carries depth
contours drawn in pure CSS. This replaced v1.0's "quiet editorial,
soft-brutalist" look — the warm paper, 2 px ink borders and *offset* hover
shadows are gone.

Explicitly banned: purple/blue AI-gradient hero, glassmorphism cards (blur
is reserved for the sticky header and the modal backdrop), stock 3D
illustrations, emoji as UI icons, more than one accent hue, colour as the
only carrier of meaning (status icons differ in shape too — §6).

The site should feel like a well-set reference book you happen to be able to
search — calm, dense with information, quietly confident.

## 2. Design tokens

Defined once in `src/styles/global.css`; every colour is a `--sh-*` custom
property switched by `html[data-theme]`, and Tailwind v4's `@theme` exposes
each one as a utility (`--color-sh-muted` → `text-sh-muted`,
`bg-sh-surface`, `border-sh-control`, `shadow-sh-2`, …). Utilities — never a
`style=` attribute, which CSP `style-src` drops silently (docs/09 §4).

| Token | Light "chart paper" | Dark "night harbour" | Use |
|---|---|---|---|
| `--sh-bg` | `oklch(0.975 0.007 230)` | `oklch(0.17 0.03 255)` | page background |
| `--sh-surface` | `oklch(0.995 0.003 230)` | `oklch(0.205 0.034 255)` | cards, panels, dialogs |
| `--sh-surface-2` | `oklch(0.952 0.012 232)` | `oklch(0.245 0.036 255)` | tiles, pills, hover fills |
| `--sh-ink` | `oklch(0.24 0.035 252)` navy | `oklch(0.94 0.012 230)` | primary text |
| `--sh-muted` | `oklch(0.47 0.03 250)` | `oklch(0.75 0.025 240)` | secondary text, placeholders |
| `--sh-accent` | `oklch(0.5 0.13 245)` harbour blue | `oklch(0.77 0.11 230)` | links, active state, focus, primary buttons |
| `--sh-accent-ink` | `oklch(0.985 0.005 240)` | `oklch(0.18 0.04 255)` | text on accent |
| `--sh-accent-soft` | `oklch(0.94 0.03 240)` | `oklch(0.27 0.05 245)` | accent tint (icon tiles, selection) |
| `--sh-ok` / `-ok-soft` | `oklch(0.5 0.12 155)` / `oklch(0.95 0.035 155)` | `oklch(0.78 0.13 155)` / `oklch(0.27 0.045 160)` | "clean" status, `free` chip |
| `--sh-warn` / `-warn-soft` | `oklch(0.53 0.12 62)` / `oklch(0.95 0.04 75)` | `oklch(0.82 0.12 78)` / `oklch(0.28 0.045 70)` | "unverified" status, `onetime` chip |
| `--sh-danger` | `oklch(0.52 0.18 25)` | `oklch(0.74 0.15 25)` | destructive/flag copy only |
| `--sh-border` | `oklch(0.88 0.014 240)` | `oklch(0.31 0.03 252)` | **hairline**: separates and frames, never a control's only edge |
| `--sh-control` | `oklch(0.6 0.035 248)` | `oklch(0.6 0.03 245)` | visible boundary of inputs, selects, buttons (≥ 3:1, WCAG 1.4.11) |
| `--sh-contour` | accent at 14 % | accent at 16 % | welcome-hero depth contours |
| `--sh-shadow-1/2/3` | navy-tinted, soft | black, deeper | rest · hover lift · overlays (dialogs, popover) |

Shape & depth: radii `--radius-card` **14px** · `--radius-tile` **12px** ·
`--radius-btn` **10px** · `--radius-pill` 999px; borders are **1px**
(`--sh-border` hairline for framing, `--sh-control` for anything you can
operate); shadows are blurred and layered (`shadow-1` at rest, `shadow-2`
on hover lift, `shadow-3` for the gate, the filter sheet and the display
menu); focus ring `2px` accent, `2px` offset. Scrollbar colours derive from
`--sh-ink` (`color-mix`), so they follow the theme. Spacing: Tailwind
default 4 px scale; page gutter `16px` mobile / `24px` ≥ md.

**Dark mode with JS off.** `theme.js` sets `data-theme` pre-paint (docs/05
§A8); with scripting disabled there is no attribute, and a
`@media (prefers-color-scheme: dark) { :root:not([data-theme]) { … } }`
block applies instead. That block must stay *identical* to
`:root[data-theme='dark']` — `src/styles/contrast.test.ts` compares them.

**Contrast is a test, not a review item.** `contrast.test.ts` reads
`global.css`, converts each OKLCH token the way browsers do (OKLab → linear
sRGB, gamut-clipped) and checks WCAG 2.2 ratios in **both** themes: `ink` ≥
7:1 and `muted`, `accent`, `ok`, `warn`, `danger` ≥ 4.5:1 on `bg`,
`surface` and `surface-2`; `control` ≥ 3:1 on all three; `accent-ink` on
`accent`, `ok` on `ok-soft`, `accent` on `accent-soft`, `warn` on
`warn-soft` and `ink` on `accent-soft` ≥ 4.5:1. A colour tweak that breaks
legibility fails `pnpm test`.

## 3. Typography

| Role | Font | Notes |
|---|---|---|
| Display / headings | **Bricolage Grotesque** (variable) | Distinctive without being loud; Vietnamese subset |
| Body / UI | **Be Vietnam Pro** 400 · 500 · 700 | Designed for Vietnamese; excellent diacritic rendering |
| Badges / dates / SPDX ids | **IBM Plex Mono** 400 · 500 | Vietnamese subset; gives data a "spec sheet" texture |

Unchanged by the v1.1 refresh. Be Vietnam Pro (400/500/700) and IBM Plex
Mono (400/500) are imported per subset, `latin` + `vietnamese` only.
Bricolage's variable package ships one stylesheet covering vietnamese,
latin-ext and latin; each `@font-face` carries a `unicode-range`, so a
browser still downloads only the subsets a page uses. `font-display: swap`;
fallback stacks end in `system-ui` / `monospace`.

Scale, as `--text-*` tokens (desktop → mobile below 40 rem): hero 64/42
(welcome headline only) · display 44/36 · h1 36/30 · h2 24/22 · h3 19/18 ·
body 16 · small 14 · badge 12.5. Line-height 1.6 body, 1.15 headings;
headings use `text-wrap: balance`. Vietnamese check: stacked diacritics (ậ,
ễ, ữ) must not clip at any size — add to visual QA.

## 4. Global layout

**Header (sticky, frosted glass):** `.sh-glass` — the page background at
80 % with `backdrop-filter: blur(14px) saturate(1.4)` over a hairline
bottom rule; without `backdrop-filter` support it is simply opaque. Left to
right: the **anchor mark** on an accent tile + wordmark `SoftHarbor`
(Bricolage; the wordmark hides below `sm`, a screen-reader name stays) ·
nav `Apps · Categories` with Lucide icons, the current section marked by
`aria-current="page"` and a short accent underline (not colour alone) · a
search hint styled as a field with a `/` key cap (`lg`+; a real link to
`/apps#search`) · `ShLangSwitch` (segmented `EN | VI`) · `ShPrefs` (display
menu icon button, docs/05 §A8).

**Footer — five columns** (two on phones): **brand** (mark, tagline, license
line "Code GPL-3.0 · Data CC BY-SA 4.0", build date) · **Browse** (Apps,
Categories, Search) · **Open data** (`/api/apps.json`, `/rss.xml`, the CC
BY-SA 4.0 data licence) · **Legal** (all six documents) · **Project**
(Contact, GitHub ↗, Releases ↗, `ShBugReport` "Report a bug").

## 5. Pages

**Welcome `/`** — no island at all. **Hero** over the depth contours
(`.sh-contours`: repeating radial rings plus a dot grid, masked to fade,
kept inside the section so it can never widen a phone's layout viewport):
eyebrow, headline at `--text-hero`, subline, a **search field that is a
link** to `/apps#search` ("Search 326 apps…" with a `/` key cap — the real
search is the island on `/apps`), and two buttons: Browse all apps
(primary) · All categories. Beside it, the **"Manifest" ledger**: figures
counted from the data at build time — apps listed, completely free, buy
once, no known warnings, and per-platform counts — in ruled mono rows.
Then the **12-category grid** (icon tile, label, localized count, stretched
link) and **"How this list works"** — three numbered principles (01 official
links only · 02 free or own it once · 03 dated, honest status). The v1.0
"Latest additions" row was dropped in the refresh (every entry still shares
the seed's `addedAt`, 2026-07-28); `/rss.xml` remains the new-entries
channel.

**Grid `/apps`** — eyebrow + h1 + one-line intro ("Every link goes to the
developer's official page…"); toolbar: search input (`ShSearch`, search
icon, placeholder "Search apps… ( / )"), sort select (A–Z · Newest, plus
"Best match" while a query is active — docs/05 §A2), filter button with an
active-count chip (`ShFilterSheet`). Result count line (`aria-live`,
plural-aware). Card grid §6. Empty state, hidden until filtering yields
nothing: "No apps match. Try fewer filters or a different word."

**Filter sheet** — native `<dialog>` (`showModal`): full-height right-side
panel (24 rem) from 640 px up, a bottom sheet (max 80 dvh) below. Facets:
Category (registry order, localized labels), Platform (Windows/macOS/Linux),
Pricing (Free / Free + one-time / One-time). Footer: "Clear all" (disabled
when nothing is active; also clears the query) + "Show N apps" — the visible
text *is* the accessible name (WCAG 2.5.3), pluralised.

**Categories `/categories`** — one tile per category: icon, name, count and
the first three app names (name order), so a tile says what is inside
before the click.

**Category `/categories/[id]`** — back link to Categories, icon tile + h1
(the label) + count, then the grid: newest first, name as the tie-break —
the `/apps` "Newest" order exactly (docs/05 §A3).

**Detail `/apps/[slug]`** — breadcrumb (Apps › primary category › name).
**Hero panel**: logo on an 80 px tile + name (h1) + **developer line**
directly under the h1 (the `developer` value, muted) + price chip (toned,
§6) and license pill; the summary at h3 size. **Action rail**: Download ↗
(accent-filled, *first* — the page's one loud element) · Homepage ↗ ·
Repository ↗ (absent when null), then the note "Links go to the official
site. SoftHarbor hosts no downloads." **Facts ledger** ("At a glance",
`<dl>` in ruled rows): developer · platforms · license · tags · security
line · added · updated. **Security-meaning panel** beside it, tinted ok or
warn by status, explaining what the status does and does not mean, linking
the Disclaimer. **"More in <category>"**: up to four cards from the primary
category, name order.

The **security line carries a "View scan ↗" link** whenever
`security.evidence` is set, at any status. Hard rule 4 caps what the copy may
claim at "no known warnings as of &lt;date&gt;", so the claim is worth much
more when the reader can open the scan and judge it. It matters most on an
entry held at `unverified` *because* something was found: the link is how a
reader sees what, instead of being told only that we were unsure.

The developer line sits *above* the action rail on purpose: a reader should
be able to match "who makes this" against the domain they are about to
click. It is plain text, never a link — we do not maintain vendor pages. (Its
label, "Developer", now lives in the facts ledger.)

**Legal `/legal/*`** — eyebrow, h1, the document's own "Last updated" stamp
(`LEGAL_UPDATED`, docs/14 Part 2), the fixed VI notice on the VI side, then
the document (`.sh-prose`: numbered clauses keep their numbers, links are
underlined). **No inter-document nav in the page body**: the footer already
lists all six on every page, and repeating them a screen apart is noise.

**Contact `/contact`** — one card per purpose (nine `@poli0981.dev`
addresses from `src/lib/contacts.ts`, ordered by urgency: security first,
press and collaboration last; the DMCA card links Terms `#copyright`), a
panel pointing everything else to GitHub issues, and a languages note.
Gate-exempt: a security or copyright notice must never wait behind "I
understand and accept".

**Error/offline pages** — one shared shell (`ErrorPage.astro`), **bilingual
on one page** (an error can be reached from either locale, and `/offline`
with no network at all): the status code set huge in the ledger's mono,
accent at 25 % opacity and `aria-hidden` (`···` for offline), then an EN
panel and a `lang="vi"` panel side by side, each with an icon tile, title
and explanation from the dictionaries (`error.<kind>.*`). Buttons: Home ·
Apps · Trang chủ (VI home). All are `noindex` — `/404` requested directly is
a 200 — gate-exempt, and emit no hreflang alternates.

## 6. Card anatomy

```
┌──────────────────────────────────────────────┐
│ ┌────┐ 7-Zip                          [FREE] │  48px logo tile · name
│ │logo│ Igor Pavlov                           │  (h2, 17px, 600) · developer
│ └────┘                                       │  (muted, truncated) · price chip
│ File archiver with high-ratio 7z             │  summary, 2-line clamp,
│ compression and support for dozens…          │  muted
│ [LGPL-2.1-or-later]  ▭ Windows · Linux       │  SPDX pill · platforms
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │  dashed rule
│ ⛉✓ No known warnings · checked 30 Jul 2026   │  shield icon + status (mono)
│ File Management   Utilities                  │  category chips (links)
└──────────────────────────────────────────────┘
```

- **Card markup — stretched link, never a wrapping `<a>`.** An `<a>` nested
  inside another `<a>` is invalid HTML: the parser *closes* the outer anchor
  when it meets the inner one, so the card link silently breaks and the
  "A11y = 100" gate (docs/13 §2) cannot pass. Use the standard pattern
  instead — the card is an `<article class="relative">`, the **app name** is
  the only link to the detail page and carries the overlay
  (`global.css`):

  ```css
  .sh-stretch::after { content: ''; position: absolute; inset: 0; }
  ```

  Category chips are then ordinary **sibling** links raised above the
  overlay (`relative z-1`) and navigate normally. One card = one primary
  link in the accessibility tree. The name is an `h2` on `/apps` and
  category pages and an `h3` inside "More in <category>", so no page skips
  a heading level.
- Each card wrapper carries the facet data the grid controller needs
  (docs/05 §A3): `data-slug`, `data-name`, `data-categories`,
  `data-platforms`, `data-pricing`, `data-added`. These are the **only**
  source filtering and sorting read, so both work before
  `/search-index.json` has loaded — and keep working if the user never
  touches search.
- **Price chip, toned by pricing:** `free` → ok (green) · `free-onetime` →
  accent (blue) · `onetime` → warn (amber), each text-on-tint pair ≥ 4.5:1
  (§2). Localized labels (`FREE`, `FREE + ONE-TIME`, `ONE-TIME`). SPDX id
  as a neutral mono pill, only when open source. Platforms as a monitor icon
  plus the platform names — words, not glyphs.
- Security line copy (exact, both locales in dictionaries). **Each string
  renders the date field it actually names** — the dated-honesty claim is the
  product (hard rule 4), so the words and the data must not drift apart:
  `clean` → "No known warnings · checked {date}" ← `security.checkedAt` ·
  `unverified` → "Not yet verified · listed {date}" ← **`addedAt`** ·
  `flagged` → never rendered (quarantined before build). The status icon
  differs in **shape and colour** — `shield-check` in ok, `shield-question`
  in warn — so it never rests on colour alone (WCAG 1.4.1).
- Category chips print the category **label** in the page's language (they
  printed the raw id before v1.1).
- States: hover (pointer devices only) = `translateY(-2px)` + `shadow-2` +
  an accent-tinted border, and the logo tile's icon "pops" (§7);
  keyboard focus anywhere in the card outlines the **whole card**
  (`:has(:focus-visible)`); filtered-out = `hidden` attr (A3).
- **`content-visibility: auto`** with `contain-intrinsic-size: auto 15rem`:
  with 326 cards on `/apps`, the browser skips layout and paint for the ones
  off screen while the scrollbar stays honest.

## 7. Motion

Tokens: `--duration-fast` 150 ms (hover/focus colour, borders) ·
`--duration-slow` 250 ms (lift, icon motion); easing `--ease-sh`
`cubic-bezier(.2,.8,.2,1)`, plus `--ease-spring` `cubic-bezier(.34,1.56,.64,1)`
for pops. Motion is **opt-in per element**, through classes in
`global.css`:

| Class | Effect | Used for |
|---|---|---|
| `sh-anim` | marks the control an icon reacts to (hover, or keyboard focus) | links, buttons, cards |
| `sh-nudge-x` | icon slides 3 px right | "go there" arrows |
| `sh-nudge-diag` | icon moves 2 px up-right | ↗ links that leave the site |
| `sh-pop` | icon scales 1.12 and tilts −6°, spring easing | tiles, the anchor mark |
| `sh-draw` | strokes redraw (dash-offset, 0.8 s), hover only | decorative icons |
| `sh-rise` | fade + 12 px rise on first paint (0.6 s) | hero panels |
| `sh-stagger` | children rise 45 ms apart, capped at 495 ms from the 12th | hero, category grids, contact cards |

`ShIcon` takes the effect as a prop (`motion="nudge-x" | "nudge-diag" |
"pop" | "draw"`); hover variants sit behind `@media (hover: hover)`, focus
variants do not. Delays are classes, never inline styles (CSP). Cards have
**no** entrance animation — the grid reorders by moving nodes (docs/05
§A3).

**View Transitions:** a native cross-document fade (docs/02 §6), opted in
only under `prefers-reduced-motion: no-preference`; browsers without
support simply navigate.

**Reduced motion collapses everything to instant**, whether the OS asks
(`prefers-reduced-motion: reduce`) or the visitor picks Motion → Reduce in
the display menu (`html[data-motion="reduce"]`, applied pre-paint): animation
and transition durations go to 0.01 ms, **delays to 0** (a staggered element
would otherwise sit invisible for its delay under fill mode `both`),
iteration counts to 1, smooth scrolling off, and the view-transition
pseudo-elements lose their animation.

**The card→detail morph is withdrawn (2026-07-30) — it is not implementable
under this CSP.** `transition:name` makes Astro emit a per-slug `<style>`, and
Astro does not put that style's hash into the page's own CSP, so the browser
refused it on every load. Allow-listing all 326 hashes would add ~17 KB to
every page head (~12 MB across the build) for a 180 ms effect, and a nonce
would mean running every page through a Worker, which D25 explicitly rules
out. It had never animated in any case: a morph needs the same
`view-transition-name` on both sides, and the card never carried one.
Revisit only if Astro starts hashing transition styles. The cross-document
fade is unaffected — its one inline style is hashed by `astro.config.ts`.

## 8. Responsive

| Breakpoint | Grid cols | Notes |
|---|---|---|
| < 640 | 1 | filter sheet, legal gate = bottom sheets; mobile type step; wordmark hidden (mark only); search full-width; footer 2 columns |
| ≥ 640 (`sm`) | 2 | filter = right-side panel |
| ≥ 768 (`md`) | 2 | page gutter 24 px; footer 5 columns |
| ≥ 1024 (`lg`) | 3 | header search hint appears; detail facts + status side by side |
| ≥ 1280 (`xl`) | 4 | max content width 1360 px |

Touch targets ≥ 44×44 px (`.sh-btn`, gate button and filter rows have
`min-height: 44px`); hover effects gated behind `@media (hover:hover)`.
**Nothing may widen the layout viewport on a phone**: single-column grids
are `minmax(0, 1fr)` and the hero contours stay inside their section — a
long developer name or the decoration once widened phones to 459–620 px.
The e2e suite fails any page whose document overflows sideways (docs/11
§5).

## 9. Accessibility checklist

- Contrast ≥ 4.5:1 text, ≥ 3:1 control boundaries — **enforced** for every
  token pair in both themes by `src/styles/contrast.test.ts` (§2; adjust L
  values, keep hues), and checked on rendered pages by axe in the e2e suite
  (light and dark, serious/critical findings fail — docs/11 §5).
- Keyboard: `/` jumps to search from **any** page — on `/apps` `ShSearch`
  focuses its box, elsewhere `ShPrefs` navigates to `/apps#search`.
  Suppressed inside text fields, with modifier keys, **and while the legal
  gate is open** (`body[data-sh-gate="open"]`) — a global shortcut that
  reaches through a modal defeats the focus trap and can scroll content the
  user hasn't accepted yet. Esc in search clears, then blurs. A skip link
  ("Skip to content") comes first; `scroll-padding-top` keeps focused or
  anchored content out from under the sticky header (WCAG 2.4.11). Tab order
  header → toolbar → cards → footer, and the grid's DOM order always equals
  its visual order (docs/05 §A3).
- Overlays use the platform: the filter sheet and the legal gate are native
  `<dialog>`s opened with `showModal()` (focus trap, inert background);
  the gate also sets `closedby="none"` and re-opens if Esc or the browser
  closes it early (docs/14 Part 2). The gate focuses its heading first, so a
  screen reader reads the notice before any control. The display menu is a
  `popover`.
- `aria-live="polite"` result count; `aria-current` on the current nav
  section (with an underline, not colour alone); icons decorative
  (`aria-hidden`) unless they are a control's only name; status shown by
  icon shape *and* colour; links in running text (legal prose, the gate)
  are underlined (WCAG 1.4.1).
- Visible text stays inside the accessible name (WCAG 2.5.3): the language
  switch reads "EN — English" / "VI — Tiếng Việt" (the endonym appended in
  a matching `lang`, never replacing "EN"/"VI"), and the filter sheet's
  submit button is named by its own "Show N apps" text.
- `lang` attribute correct per locale, including the `lang="vi"` panel on
  bilingual error pages and the VI suggestion banner on EN pages.
- Zoom to 200 % without horizontal scroll (the e2e suite fails any sideways
  overflow at desktop and Pixel 7 sizes); VoiceOver + NVDA on the grid, the
  filter sheet and the gate remain a manual launch-checklist item (docs/13
  §2).
