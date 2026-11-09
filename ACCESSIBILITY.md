# Accessibility

SoftHarbor exists so that anyone setting up a computer can find official software
quickly. That has to include people who use only a keyboard, a screen reader,
magnification, voice control or a high-contrast theme — and people with those needs
who want to contribute.

This file is the project's accessibility statement for contributors: what we aim
for, what the site already does, how changes are kept accessible, and how to report
a barrier. The visitor-facing version, in English and Vietnamese, is
**[softharbor.net/legal/accessibility](https://softharbor.net/legal/accessibility)**.
Keep the two in step (docs/14 §3g).

## Priorities

- **Target: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA.** It guides the work;
  it is **not** a claim of verified conformance. No independent audit has been done,
  and we will not claim conformance without one that names its scope, date, method
  and evaluator.
- **Keyboard first.** Everything is reachable and operable with the keyboard, in a
  logical order, with a visible focus indicator and no traps.
- **Screen readers.** Semantic HTML, a heading per page and a logical outline,
  landmarks, real lists and tables, and `lang` on every page and every passage in the
  other language, so English and Vietnamese are pronounced correctly.
- **Readable everywhere.** Contrast that holds in both themes, nothing conveyed by
  colour alone, text that zooms to 200 % and reflows to 320 CSS px.
- **Respect the visitor's settings.** Reduced motion and forced colours (Windows
  contrast themes) from the system, plus the site's own display menu.

## What the site does today

| Area             | How                                                                                          | Where                                     |
| ---------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Skip link        | "Skip to content" is the first stop on every page                                            | `src/layouts/Base.astro`                  |
| Landmarks        | `header`, labelled `nav`s, `main`, `footer`, breadcrumb `nav`/`ol`                           | `ShHeader`, `ShFooter`, `AppDetailPage`   |
| Language         | `<html lang>`, hreflang alternates, `lang` on every passage in the other language            | `Base.astro`, `ShLangSwitch`              |
| Focus            | Global `:focus-visible` ring, whole-card ring on app cards, visible on selected segments too | `src/styles/global.css`, `ShPrefs`        |
| Dialogs          | Native `<dialog>` (`showModal`) and `popover`: focus handling and Esc from the browser       | `ShLegalGate`, `ShFilterSheet`, `ShPrefs` |
| Status messages  | Result count in an `aria-live` region; search errors in a persistent `role="status"`         | `AppsPage.astro`, `ShSearch`              |
| Contrast         | Tokens tested: ink ≥ 7:1, text ≥ 4.5:1, control edges ≥ 3:1, light and dark                  | `src/styles/contrast.test.ts`             |
| Not colour alone | Security status has its own icon shape; current section underlined                           | `ShAppCard`, `ShHeader`                   |
| Display menu     | Theme, scrollbar, reduced motion, and **"/" shortcut on/off** (WCAG 2.1.4)                   | `ShPrefs`, `src/scripts/theme.js`         |
| Forced colours   | Current section, selected segments and focus stay visible                                    | `ShHeader`, `ShPrefs`, `ShLangSwitch`     |
| Images           | No images of text; logos are decorative and the name is always text                          | `ShAppCard`, `ShIcon`                     |
| Targets          | Buttons 44 px, header controls 38–40 px, inline category links 24 px                         | `global.css`, `ShAppCard`                 |
| Tables           | `caption`, `scope="col"`, keyboard-scrollable region on narrow screens                       | `src/components/legal/`                   |
| New tabs         | The one link that opens a new tab says so to screen readers                                  | `ShBugReport`                             |

## Contributor expectations

Every user-facing change keeps these guardrails. The
[pull request template](.github/PULL_REQUEST_TEMPLATE.md) carries the checklist.

**Automated — CI blocks the merge.**

- `pnpm e2e` runs axe (`@axe-core/playwright`, WCAG 2.0/2.1/2.2 A and AA rules) on the
  main pages in both themes, on Desktop Chrome and a Pixel 7 viewport, plus the open
  legal gate, filter sheet and display menu (`e2e/smoke.spec.ts`, `e2e/a11y.spec.ts`).
  Critical, serious and moderate findings fail.
- The same suite checks the skip link, focus return from dialogs, the shortcut switch,
  reflow at 320 px and forced colours; `pnpm test` pins contrast and the islands'
  names, roles and states.
- If a violation genuinely cannot be fixed, say why in the PR description — never
  disable a rule silently.

**By hand, for anything interactive.**

- One keyboard-only pass: Tab / Shift+Tab reaches every control in a sensible order,
  focus is always visible, Enter / Space / arrows / Esc do what they should, and you
  can get into and out of every dialog and menu.
- A screen-reader spot check (Narrator, NVDA or VoiceOver): headings and landmarks
  navigate, every control has a name that matches its visible label, state changes
  (expanded, selected, checked) are announced, dynamic updates are read out.
- Zoom to 200 % and narrow to 320 px: nothing is cut off and nothing scrolls sideways
  except data tables.

**Content.** Logical heading levels, real lists, descriptive link text (never "click
here"), no colour-only meaning, alternative text where an image carries meaning, and
both languages for every UI string (hard rule 6).

## Reporting an accessibility barrier

We treat accessibility reports as expertise, not complaints. You never need to tell us
about a disability.

- **Email:** accessibility@poli0981.dev — no GitHub account needed.
- **GitHub:** the
  [Accessibility issue form](https://github.com/poli0981/softharbor/issues/new?template=accessibility.yml).

If you can, include the page address, what you were trying to do, what happened
instead, and your operating system, browser and assistive technology with versions. A
screenshot or recording is welcome and never required. English or Vietnamese.

### Severity

Maintainers assign or confirm it during triage; reporters do not have to.

- **Critical** — stops a core task: finding an app, reading its listing, or opening its
  official links.
- **Serious** — significant difficulty, but a workaround exists.
- **Moderate** — an annoyance or an inconsistent experience.
- **Minor** — little effect on use.

### How we respond

SoftHarbor is maintained by one person; these are commitments that can be kept.

- A reply within **7 days**, with the severity and the next step.
- Targets from the day the report arrives: **Critical 30 days**, **Serious 60 days**,
  **Moderate and Minor 90 days**.
- A workaround while a fix is in progress, where one exists.
- If a target slips: the reason, a revised date, and an update on the issue.
- We may ask you to confirm the fix before closing.

## Ownership

Accessibility is owned by the maintainer, [@poli0981](https://github.com/poli0981):
triaging reports, tracking known barriers, keeping this file and the site statement
current, and re-reading both at each release.

## Supported environments

**Tested by hand** (owner, 2026-11-09): keyboard only, and the Narrator screen reader, on
Windows 11 with Chrome, Brave and Firefox — no barriers found.

**Tested automatically** on every change: Chromium (Playwright Desktop Chrome and a
Pixel 7 viewport), light and dark themes, forced colours, 320 px reflow.

**Intended, not yet tested by hand:** the current and previous major versions of
Chrome, Edge, Firefox and Safari; NVDA and JAWS on Windows; VoiceOver on macOS and iOS;
TalkBack on Android. Reports from these are especially welcome.

## Known limitations

- **Bot check.** After the legal notice is accepted, Cloudflare Turnstile runs. It is a
  third-party widget whose accessibility we do not control; if it cannot finish, the
  gate lets the visitor in anyway (after 10 s, or 120 s once it asks for a click —
  docs/14 Part 2).
- **Vendor sites.** Every listing links to the developer's own site and installer;
  their accessibility is outside this project.
- **Card summaries** are clamped to two lines; the full text is on the app's page.
- **Vietnamese legal pages** are translations; the English text is canonical.
- **No formal pass yet** with NVDA, JAWS or VoiceOver, and Lighthouse CI is not wired
  (docs/13 §2, docs/15 §2 item 8).

## Feedback

Accessibility is ongoing work. Suggestions for this statement or for how the project
works are welcome as an issue, a discussion or a pull request.
