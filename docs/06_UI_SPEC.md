# 06 — UI Specification

## 1. Design direction

**"Quiet editorial, soft-brutalist."** Warm paper background, ink text, one
harbor-blue accent, visible 2 px borders, offset shadows on hover, generous
whitespace, type doing the personality work. Explicitly banned: purple/blue
AI-gradient hero, glassmorphism blur cards, stock 3D illustrations, emoji as
UI icons, more than one accent hue.

The site should feel like a well-set reference book you happen to be able to
search — calm, dense with information, quietly confident.

## 2. Design tokens

Defined once in `src/styles/global.css` via Tailwind v4 `@theme`; every
color is a `--sh-*` custom property switched by `html[data-theme]`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sh-bg` | `oklch(0.97 0.01 85)` warm paper | `oklch(0.19 0.01 85)` warm near-black | page background |
| `--sh-surface` | `oklch(0.99 0.005 85)` | `oklch(0.23 0.012 85)` | cards, sheets, dialogs |
| `--sh-ink` | `oklch(0.22 0.015 75)` | `oklch(0.93 0.008 85)` | primary text, borders |
| `--sh-muted` | `oklch(0.48 0.012 75)` | `oklch(0.70 0.01 85)` | secondary text |
| `--sh-accent` | `oklch(0.52 0.11 235)` harbor blue | `oklch(0.72 0.10 235)` | links, active filters, focus |
| `--sh-accent-ink` | `oklch(0.98 0.005 235)` | `oklch(0.16 0.02 235)` | text on accent |
| `--sh-ok` | `oklch(0.55 0.12 150)` | `oklch(0.72 0.12 150)` | "clean" status |
| `--sh-warn` | `oklch(0.62 0.13 75)` | `oklch(0.75 0.12 75)` | "unverified" status |
| `--sh-danger` | `oklch(0.55 0.19 25)` | `oklch(0.68 0.17 25)` | destructive/flag copy only |
| `--sh-border` | = ink | = `oklch(0.42 0.012 85)` | 2 px borders |

Shape & depth: radius `10px` (cards) / `999px` (pills); border `2px solid
var(--sh-border)`; hover shadow `4px 4px 0 var(--sh-border)` (offset, not
blurred — the soft-brutalist tell); focus ring `2px` accent, `2px` offset.
Spacing: Tailwind default 4 px scale; page gutter `16px` mobile / `24px` ≥ md.

## 3. Typography

| Role | Font | Notes |
|---|---|---|
| Display / headings | **Bricolage Grotesque** (variable) | Distinctive without being loud; Vietnamese subset |
| Body / UI | **Be Vietnam Pro** 400 · 500 · 700 | Designed for Vietnamese; excellent diacritic rendering |
| Badges / dates / SPDX ids | **IBM Plex Mono** 400 · 500 | Vietnamese subset; gives data a "spec sheet" texture |

Import only `latin` + `vietnamese` subsets from Fontsource;
`font-display: swap`. Fallback stacks end in `system-ui` / `monospace`.
Scale (desktop → mobile): display 44/36 · h1 32/28 · h2 24/22 · h3 19/18 ·
body 16 · small 14 · mono-badge 12.5. Line-height 1.6 body, 1.15 display.
Vietnamese check: stacked diacritics (ậ, ễ, ữ) must not clip at any size —
add to visual QA.

## 4. Global layout

**Header (sticky):** wordmark `SoftHarbor` (Bricolage; the "H" may carry a
subtle anchor-shaped counter — optional flourish) · nav `Apps · Categories`
· search shortcut hint `/` (opens/focuses search on any page) ·
`ShLangSwitch` (`EN | VI` text toggle) · `ShThemeToggle`.

**Footer:** legal links (Disclaimer · Privacy · Terms · Trademarks ·
Third-party) · license line "Code GPL-3.0 · Data CC BY-SA 4.0" · GitHub link
· `ShBugReport` ("Report a bug") · build date.

## 5. Pages

**Welcome `/`** — one-line pitch + subline (dictionary keys
`welcome.hero`), primary button → `/apps`; 12 category tiles (icon + label +
count); "Latest additions" row (5 newest cards); short "How this list
works" strip: official links only · free or own-once · dated security
status, each linking to the relevant legal/about text.

**Grid `/apps`** — toolbar: search input (`ShSearch`, placeholder
"Search apps… (/)"), filter button with active-count chip (`ShFilterSheet`),
sort select (A–Z · Newest). Result count line (`aria-live`). Card grid §6.
Empty state: friendly line + "Clear filters" + "Suggest this app →"
(app-request issue form).

**Filter sheet** — desktop: right-side panel; mobile: bottom sheet
(`<dialog>`). Facets: Category (checkbox list with icons), Platform
(Windows/macOS/Linux), Pricing (Free / Free + one-time / One-time). Footer:
"Clear all" + "Show N apps".

**Detail `/apps/[slug]`** — breadcrumb (primary category); header: logo
64 px + name (h1, `transition:name={slug}`) + **developer line** directly
under the h1 (`detail.developer` label + `developer` value, muted, body
weight) + pricing & license badges; summary paragraph; **link rail** of three
equal bordered buttons: Homepage ↗ · Repository ↗ (hidden when null) ·
Download ↗ (accent-filled — the page's one loud element); meta block (mono):
platforms · tags · security line · added/updated dates; footer note: "Links
go to the official site. SoftHarbor hosts no downloads." + "Report an issue
with this entry".

The **security line carries a "View scan ↗" link** whenever
`security.evidence` is set, at any status. Hard rule 4 caps what the copy may
claim at "no known warnings as of &lt;date&gt;", so the claim is worth much
more when the reader can open the scan and judge it. It matters most on an
entry held at `unverified` *because* something was found: the link is how a
reader sees what, instead of being told only that we were unsure.

The developer line sits *above* the link rail on purpose: a reader should be
able to match "who makes this" against the domain they are about to click.
It is plain text, never a link — we do not maintain vendor pages.

**Legal `/legal/*`** — h1, "last updated" stamp, VI courtesy notice on the VI
side, then the document. **No inter-document nav in the page body**: the
footer already lists all six on every page, and repeating them a screen apart
is noise.

**Category `/categories/[id]`** — h1 = label, count, pre-filtered grid.

**Error/offline pages** — same layout family: giant mono status code
(clipped, 40 % opacity, behind text), one-line explanation EN+VI, buttons
Home / Back. Offline adds "You appear to be offline — SoftHarbor needs a
connection to load new pages."

## 6. Card anatomy

```
┌──────────────────────────────────────────────┐
│ [logo 40px]  Name                    (7-Zip) │  name: 600, 17px
│  ⊞ ⌘ 🐧   FREE   LGPL-2.1                    │  platform icons + pills
│  File archiver with high-ratio 7z            │  summary, 2-line clamp,
│  compression and support for dozens…         │  muted
│  ── ── ── ── ── ── ── ── ── ── ── ── ──      │
│  ● No known warnings · checked 2026-07-15    │  status dot: ok/warn color
│  file-management · utilities                 │  category chips (link)
└──────────────────────────────────────────────┘
```

- **Card markup — stretched link, never a wrapping `<a>`.** An `<a>` nested
  inside another `<a>` is invalid HTML: the parser *closes* the outer anchor
  when it meets the inner one, so the card link silently breaks and the
  "A11y = 100" gate (docs/13 §2) cannot pass. Use the standard pattern
  instead — the card is an `<article class="relative">`, the **app title** is
  the only link to the detail page and carries the overlay:

  ```css
  .sh-card-title a::after { content: ''; position: absolute; inset: 0; }
  .sh-card a:not(.sh-card-title a) { position: relative; z-index: 1; }
  ```

  Category chips are then ordinary **sibling** links that sit above the
  overlay and navigate normally. One card = one primary link in the
  accessibility tree; platform icons carry `aria-label`.
- Each card wrapper carries the facet data the filter island needs (docs/05
  §A3): `data-slug`, `data-categories`, `data-platforms`, `data-pricing`,
  `data-added`. These are the **only** source filtering reads, so sorting and
  filtering work before `/search-index.json` has loaded — and keep working if
  the user never touches search.
- Pills: pricing (`FREE` ink-on-paper / `ONE-TIME` accent outline /
  `FREE + ONE-TIME`) and SPDX id (mono) only when open source.
- Security line copy (exact, both locales in dictionaries). **Each string
  renders the date field it actually names** — the dated-honesty claim is the
  product (hard rule 4), so the words and the data must not drift apart:
  `clean` → "No known warnings · checked {date}" ← `security.checkedAt` ·
  `unverified` → "Not yet verified · listed {date}" ← **`addedAt`** ·
  `flagged` → never rendered (quarantined before build).
- States: hover = translate(-2px,-2px) + offset shadow; focus-visible =
  accent ring; filtered-out = `hidden` attr (A3).

## 7. Motion

Durations 150 ms (hover/focus) · 250 ms (sheet, dialog, view transitions);
easing `cubic-bezier(.2,.8,.2,1)`. Grid entrance: stagger opacity+4 px rise,
30 ms apart, **first 12 cards only**. View Transitions: a cross-page fade.
`@media (prefers-reduced-motion: reduce)` — all of the above collapse to
instant; ClientRouter falls back to plain navigation.

**The card→detail morph is withdrawn (2026-07-30) — it is not implementable
under this CSP.** `transition:name` makes Astro emit a per-slug `<style>`, and
Astro does not put that style's hash into the page's own CSP, so the browser
refuses it on hard loads and on swaps alike. Allow-listing all 326 hashes
would add ~17 KB to every page head (~12 MB across the build) for a 180 ms
effect, and a nonce needs a Worker (hard rule 1). It had never animated in any
case: a morph needs the same `view-transition-name` on both sides, and the
card never carried one. Revisit only if Astro starts hashing transition
styles. The fade is unaffected — that style *is* hashed correctly.

## 8. Responsive

| Breakpoint | Grid cols | Notes |
|---|---|---|
| < 640 | 1 | filter = bottom sheet; sticky compact header; search full-width |
| ≥ 640 | 2 | |
| ≥ 1024 | 3 | filter = side panel |
| ≥ 1440 | 4 | max content width 1360 px |

Touch targets ≥ 44×44 px; hover effects gated behind `@media (hover:hover)`.

## 9. Accessibility checklist

- Contrast ≥ 4.5:1 body, ≥ 3:1 large text & UI — verify both themes with
  the token table above (adjust L values, keep hues).
- Keyboard: `/` focuses search (suppressed inside inputs, **and while the
  legal gate is open** — a global shortcut that reaches through a modal
  defeats the focus trap and can scroll content the user hasn't accepted yet)
  · Esc clears then blurs · Tab order header → toolbar → cards → footer ·
  sheet & gate use native `<dialog>` (focus trap, `aria-modal`, Esc — gate
  intercepts Esc, docs/14 §2).
- `aria-live="polite"` result count; icons decorative (`aria-hidden`) with
  text alternatives; `lang` attribute correct per locale, including
  `lang="vi"` snippets embedded in EN pages.
- Zoom to 200 % without horizontal scroll; test VoiceOver + NVDA on the grid
  and the gate before launch (docs/13 §2).
