# SoftHarbor

**[softharbor.net](https://softharbor.net)** — a bilingual (EN/VI) directory of
desktop software that is **free**, or **buy-once**. Never subscription-only.

You just reinstalled Windows. Instead of googling ten tools one by one and
hoping the top result is not a typosquatted download page, you open one page,
filter by category and platform, and go straight to every **official** source.

The site hosts **no binaries**. It is a map, not a mirror.

## What is in it

**365 apps** across 14 categories, each one file in `src/data/apps/`. Every
entry carries:

- original two-line summaries in English _and_ Vietnamese — written from
  scratch, never pasted, which is what lets the dataset carry CC BY-SA
- links to the developer's own homepage, repository and download page
- a pricing badge (`free` · `free-onetime` · `onetime`) and an SPDX licence
  badge when the app is open source
- a **dated** security status with the scan permalink behind it

On security the site says _"no known warnings as of &lt;date&gt;"_ and never
more than that. 320 entries are `clean`; 6 are held at `unverified` because at
least one scanner flagged something, and holding them is more honest than
explaining it away. The scan is linked either way — judge it yourself.

## How it is built

Static. No database, no accounts, no cookies; fonts, icons and scripts are
self-hosted. The exceptions are deliberate and small: one tiny Worker endpoint
that checks the legal gate's Cloudflare Turnstile token (`worker/`, and the
gate lets you in even if the check cannot run), and cookieless Cloudflare Web
Analytics, which does not load at all when your browser sends Global Privacy
Control. The [Privacy Policy](https://softharbor.net/legal/privacy) has the
details.

Astro 7 (static) · Svelte 5 islands · Tailwind CSS 4 · TypeScript strict ·
Node 26 · pnpm 11 · Cloudflare Workers Static Assets (+ one Worker route).
Tested with Vitest (unit, islands, build scripts, the Worker) and Playwright +
axe on the built site; analysed by CodeQL and SonarQube Cloud.

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

Suggest an app or report a bug with the
[issue forms](https://github.com/poli0981/softharbor/issues/new/choose).
Read **[CONTRIBUTING.md](CONTRIBUTING.md)** before opening a pull request — it
lists the inclusion criteria and what gets closed on sight.

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

| About                                               | Address                |
| --------------------------------------------------- | ---------------------- |
| A vulnerability, or a hijacked or malicious listing | security@poli0981.dev  |
| Privacy                                             | privacy@poli0981.dev   |
| Terms, disclaimer, other legal                      | legal@poli0981.dev     |
| A copyright complaint                               | dmca@poli0981.dev      |
| Changing or removing your app's listing or logo     | takedown@poli0981.dev  |
| Licensing of the code or the dataset                | copyright@poli0981.dev |
| Code of Conduct                                     | code@poli0981.dev      |
| Press                                               | press@poli0981.dev     |
| Collaboration                                       | collab@poli0981.dev    |
