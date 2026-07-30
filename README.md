# SoftHarbor

**[softharbor.net](https://softharbor.net)** — a bilingual (EN/VI) directory of
desktop software that is **free**, or **buy-once**. Never subscription-only.

You just reinstalled Windows. Instead of googling ten tools one by one and
hoping the top result is not a typosquatted download page, you open one page,
filter by category and platform, and go straight to every **official** source.

The site hosts **no binaries**. It is a map, not a mirror.

## What is in it

**326 apps** across 12 categories, each one file in `src/data/apps/`. Every
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

Fully static. No server, no database, no backend, no tracking, and no
third-party request at runtime — fonts, icons and scripts are all self-hosted.

Astro 7 (static) · Svelte 5 islands · Tailwind CSS 4 · TypeScript strict ·
Node 24 · pnpm 10 · deployed to Cloudflare Workers Static Assets.

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
pnpm build
pnpm check:styles  # every emitted style is allowed by the page CSP
pnpm check:sw      # the service worker matches its spec
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

**contact@softharbor.net** · maintained by [@poli0981](https://github.com/poli0981)
