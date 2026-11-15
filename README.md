# SoftHarbor

[![Status: maintenance mode](https://img.shields.io/badge/status-maintenance%20mode-blue)](#project-status)
[![ci](https://github.com/poli0981/softharbor/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/poli0981/softharbor/actions/workflows/ci.yml)
[![codeql](https://github.com/poli0981/softharbor/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/poli0981/softharbor/actions/workflows/codeql.yml)
[![qodana](https://github.com/poli0981/softharbor/actions/workflows/qodana.yml/badge.svg?branch=main)](https://github.com/poli0981/softharbor/actions/workflows/qodana.yml)
[![Quality gate](https://sonarcloud.io/api/project_badges/measure?project=poli0981_softharbor&metric=alert_status)](https://sonarcloud.io/summary/overall?id=poli0981_softharbor)
[![Release](https://img.shields.io/github/v/release/poli0981/softharbor)](https://github.com/poli0981/softharbor/releases/latest)
[![Code: GPL-3.0-only](https://img.shields.io/badge/code-GPL--3.0--only-blue)](LICENSE)
[![Data: CC BY-SA 4.0](https://img.shields.io/badge/data-CC%20BY--SA%204.0-lightgrey)](LICENSE-DATA.md)

**[softharbor.net](https://softharbor.net)** — a bilingual (EN/VI) directory of
desktop software that is **free**, or **buy-once**. Never subscription-only.

You just reinstalled Windows. Instead of googling ten tools one by one and
hoping the top result is not a typosquatted download page, you open one page,
filter by category and platform, and go straight to every **official** source.

The site hosts **no binaries**. It is a map, not a mirror.

## Project status

**Maintenance mode since 2026-11-15 (v1.4.1).** SoftHarbor does what it set
out to do, so from here on it is maintained, not extended
([announcement](https://github.com/poli0981/softharbor/discussions/75), decision D36 in
[docs/15](docs/15_ROADMAP.md)).

- **Still happening:** apps added, corrected and removed; every download page
  re-scanned at least every 90 days; bug, UI/UX and accessibility fixes;
  dependency updates on a schedule — and out of schedule for a High or
  Critical CVE, a serious Node.js security release, a major TypeScript, Astro
  or Cloudflare Workers update, or anything that puts the site at risk.
- **Not accepted:** new features. Issues and pull requests that propose one
  are closed as _not planned_.

What to send where: [CONTRIBUTING.md → Maintenance mode](CONTRIBUTING.md#maintenance-mode).

## What is in it

**373 apps** across 15 categories, each one file in `src/data/apps/`. Every
entry carries:

- original two-line summaries in English _and_ Vietnamese — written from
  scratch, never pasted, which is what lets the dataset carry CC BY-SA
- links to the developer's own homepage, repository and download page
- a pricing badge (`free` · `free-onetime` · `onetime`) and an SPDX licence
  badge when the app is open source
- a **dated** security status with the scan permalink behind it

On security the site says _"no known warnings as of &lt;date&gt;"_ and never
more than that. 364 entries are `clean`; 9 are held at `unverified` — a
scanner flagged something, or an advisory or an unsigned build is still open —
and holding them is more honest than explaining it away. The scan is linked
either way — judge it yourself.

## How it is built

Static. No database, no accounts, no cookies; fonts, icons and scripts are
self-hosted. The exceptions are deliberate and small: one tiny Worker
(`worker/`) that rate-limits floods — over the limit you get a "Too many
requests" page for a few seconds — and checks the legal gate's Cloudflare
Turnstile token (the gate lets you in even if the check cannot run), and
cookieless Cloudflare Web
Analytics, which does not load at all when your browser sends Global Privacy
Control. The [Privacy Policy](https://softharbor.net/legal/privacy) has the
details.

Astro 7 (static) · Svelte 5 islands · Tailwind CSS 4 · TypeScript strict ·
Node 26 · pnpm 11 · Cloudflare Workers Static Assets (+ one small Worker).
Tested with Vitest (unit, islands, build scripts, the Worker) and Playwright +
axe on the built site; analysed by CodeQL, SonarQube Cloud and Qodana.

```bash
pnpm install
pnpm dev                     # http://localhost:4321
pnpm build && pnpm preview   # build, then serve dist/ with the real CSP
```

Everything that has to hold true is a gate, because on this stack most
mistakes fail _silently_ rather than loudly:

```bash
pnpm lint          # eslint + prettier
pnpm i18n:check    # EN/VI key parity
pnpm validate:data # cross-file data rules the schema cannot see
pnpm test          # vitest
pnpm check         # astro check
pnpm build         # includes the dist/ gates: CSP, assets, service worker, feed
pnpm coverage      # unit, island, build-script and Worker tests, with thresholds
pnpm e2e           # Playwright + axe against the built site
pnpm knip          # dead code and unused deps
```

## Contributing

Suggest an app, ask for a listing to be removed, corrected or re-checked, or
report a bug with the
[issue forms](https://github.com/poli0981/softharbor/issues/new/choose) —
feature requests are not taken in maintenance mode. Read
**[CONTRIBUTING.md](CONTRIBUTING.md)** before opening a pull request — it
lists the inclusion criteria and what gets closed on sight. Everyone taking
part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

Something on the site gets in your way — with a keyboard, a screen reader,
zoom or a contrast theme? [ACCESSIBILITY.md](ACCESSIBILITY.md) says what we aim
for and how reports are handled (the
[site statement](https://softharbor.net/legal/accessibility) is in English and
Vietnamese).

Found a security problem? [SECURITY.md](SECURITY.md) — please do not open a
public issue.

## Documentation

The full specification lives in [`docs/`](docs/) (00–16): architecture, data
schema, algorithms, UI, i18n, security, CI/CD, legal, and a decision log
recording why things are the way they are.

## Licence

- **Code** — GPL-3.0-only ([LICENSE](LICENSE))
- **Dataset** (`src/data/**`) — CC BY-SA 4.0 ([LICENSE-DATA.md](LICENSE-DATA.md))

App names and logos belong to their respective owners and are used only to
identify the software. Simple Icons is CC0, but the brands it depicts remain
trademarks — see [/legal/trademarks](https://softharbor.net/legal/trademarks).

AI was used to build this project; where and how is disclosed at
[/legal/ai-disclosure](https://softharbor.net/legal/ai-disclosure).

## Contact

Maintained by [@poli0981](https://github.com/poli0981). One address per
purpose, so a message reaches the right queue:

| About                                               | Address                    |
| --------------------------------------------------- | -------------------------- |
| A vulnerability, or a hijacked or malicious listing | security@poli0981.dev      |
| Privacy                                             | privacy@poli0981.dev       |
| An accessibility barrier on the site                | accessibility@poli0981.dev |
| Terms, disclaimer, other legal                      | legal@poli0981.dev         |
| A copyright complaint                               | dmca@poli0981.dev          |
| Changing or removing your app's listing or logo     | takedown@poli0981.dev      |
| Licensing of the code or the dataset                | copyright@poli0981.dev     |
| Code of Conduct                                     | code@poli0981.dev          |
| Press                                               | press@poli0981.dev         |
| Collaboration                                       | collab@poli0981.dev        |
