# Changelog

All notable changes to SoftHarbor. The site is continuously deployed; a
version marks a release announced in the repository (docs/13). Dates are
UTC.

## [1.1.0] — 2026-10-21

A full review of the site after launch: security advisories closed, real
production bugs fixed, a new look, and two Cloudflare services added with a
privacy policy rewritten to match.

### Privacy — read this if you read nothing else

v1.0 said "no analytics". That changed, deliberately and narrowly:

- **Cloudflare Web Analytics** (cookieless, nothing stored in your browser)
  now counts page views. It does **not load at all** if your browser sends
  **Global Privacy Control**, and never on preview or local hosts.
- **Cloudflare Turnstile** runs once in the legal gate, **only after** you
  accept the terms, to tell people from bots. It usually needs no click. A
  pass is remembered for 48 hours. If it cannot run — blocked, offline, or our
  endpoint down — you are let in anyway.
- The [Privacy Policy](https://softharbor.net/legal/privacy) was rewritten to
  say exactly what each of these sees and what we keep (nothing identifying),
  and the legal version was bumped, so everyone is asked to accept once more.

### Added

- **A new look ("Harbor")**: cool chart-paper light theme and a navy night
  theme, hairline rules, soft shadows, a frosted header, a home page with a
  live "manifest" of the catalogue and a category grid, redesigned app cards
  and detail pages, a five-column footer, and Lucide icons that move a little
  on hover or focus — and not at all if you ask for reduced motion.
- **Display menu**: theme (system/light/dark), scrollbar (default, thin or
  hidden — scrolling still works), and motion (system or reduced). Applied
  before the first paint, so nothing flashes.
- **Contact page** (`/contact`, `/vi/contact`) with one address per purpose:
  security, privacy, legal, copyright (DMCA), listing takedowns, licensing,
  Code of Conduct, press and collaboration — all `@poli0981.dev`.
- **Shareable search**: the query, filters and sort are kept in the URL; a
  "Best match" order while searching; Vietnamese searches ignore diacritics.
- **Installable app**: the PWA manifest is linked, with proper icons; the
  offline page now comes with its styles.
- **Third-party notices** now list every package the site is built from,
  generated at build time.
- **More "in this category"** on every app page, and a panel explaining what
  the security status does and does not mean.

### Fixed

- Hashed assets were served with two contradictory `Cache-Control` values,
  so browsers revalidated them on every visit; the JSON feeds were never
  cached. Each now gets exactly one.
- The legal gate could be dismissed with Esc in Chromium; its exemptions
  missed the real 404 and offline pages; its links looked like plain text.
- Search: a late result could filter the grid after the box was cleared;
  "Clear all" left the search text in place; a Czech-locale browser sorted 81
  of the 326 apps differently; the page announced the count twice per key.
- Small type (14 px and 12.5 px) was rendering at 16 px across the site.
- The language switcher marked English as current on Vietnamese pages and
  linked VI to the home page; its accessible name now keeps the visible code.
- Theme flicker on navigation, a growing pile of CSP tags and a sort menu that
  disagreed with the grid — all from the old soft-navigation router, now
  replaced by native page transitions.
- Pages no longer overflow sideways on phones.
- Error, 404 and offline pages are bilingual; "1 apps" is "1 app".

### Security & maintenance

- Every open Dependabot advisory closed (including a critical Astro RCE);
  dependencies refreshed; GitHub Actions pinned to commit SHAs; Dependabot
  configured (Renovate had never run).
- A tiny Worker (`worker/`, `POST /api/verify`) is the only server code; every
  page is still served as a static asset.
- The CSP now covers every script in the page head, and the build fails on
  anything the policy would silently refuse.
- Data rules enforced at build time: official links only (download portals,
  tracking parameters, look-alike hosts and invisible characters rejected),
  real dates, evidence required for a security status.
- Tests: 340+ unit, component, build-script and Worker tests (≈95 % coverage of
  shipped code, enforced), plus a Playwright + axe suite that loads every page
  type in both languages and both themes on desktop and mobile, and fails on
  any console error, CSP violation, accessibility violation or sideways
  overflow.

## [1.0.0] — 2026-07-30

First public release: 326 apps in 12 categories, English and Vietnamese,
official links only, dated security statuses with their scans linked. See the
[release notes](https://github.com/poli0981/softharbor/releases/tag/v1.0.0).

[1.1.0]: https://github.com/poli0981/softharbor/releases/tag/v1.1.0
[1.0.0]: https://github.com/poli0981/softharbor/releases/tag/v1.0.0
