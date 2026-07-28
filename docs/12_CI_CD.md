# 12 — CI/CD & Repo Automation

## 1. Overview

```
PR ──▶ ci (build + gates, both local) ──▶ review ──▶ squash to main
                                                       │
                     ┌─────────────────────────────────┤
                     ▼                                 ▼
      Cloudflare Workers Builds            quarantine.yml (paths)
      (git integration — NOT a workflow)
cron ─▶ link-check.yml (weekly) · quarantine.yml (nightly) · codeql · renovate
```

**Deployment is not a GitHub workflow.** The repository is connected to
Cloudflare via the Workers dashboard git integration, which builds and deploys
on every push to `main` and produces PR previews itself. `deploy.yml` and
`preview.yml` were removed on 2026-07-28: they duplicated that pipeline, and
they failed anyway — the API token they used carries Workers scopes but not
**Zone → Workers Routes → Edit** / **Zone → DNS → Edit**, which
`wrangler deploy` needs the moment `wrangler.jsonc` declares a `custom_domain`
(`Authentication error [code: 10000]`). The dashboard integration deploys with
account-level credentials and has no such gap.

Consequences worth knowing:

- `wrangler.jsonc` is still the source of truth for routes and asset handling —
  Workers Builds runs `wrangler deploy` against it, so the two custom domains
  (§16 §3) and `html_handling` still apply.
- The **build environment is now Cloudflare's**, not a GitHub runner. It must
  match `.nvmrc` (Node 24) and use pnpm, or the deployed output can differ from
  what CI validated. Verify after any toolchain bump (docs/13 §2).
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets (action item
  H3) are **no longer used by any workflow**. They can be deleted, and should
  be if nothing else claims them — an unused deploy credential is pure risk.
- A local `wrangler deploy` still works for the maintainer and is the fastest
  way to ship a hotfix, but it bypasses `ci`. Prefer pushing.

Everything else uses the default `GITHUB_TOKEN` with **explicit least
`permissions:` blocks in every caller** — the Phase-5 lesson: a caller stub
without its own `permissions:` block silently defaults to `none` and the
reusable workflow fails.

**The rule is stricter than "not none": a caller's permissions must be a
SUPERSET of every job in the workflow it calls — including jobs that will be
skipped.** GitHub validates this before running anything, so the failure mode
is `startup_failure` in ~1 second with no logs and no annotation pointing at
the cause. Both callers hit this on 2026-07-28: `codeql` was missing
`packages: read`, and `ci` could not satisfy `reusable-web-react.yml`'s
Pages-deploy job (`pages: write`, `id-token: write`) even with
`deploy-pages: false`. When a caller dies at startup, read the *reusable*
workflow's job-level `permissions:` blocks first.

**`CLOUDFLARE_API_TOKEN` needs zone scopes, not just Workers.** The "Edit
Cloudflare Workers" template alone fails with `Authentication error
[code: 10000]` on `/zones/…/workers/routes` as soon as `wrangler.jsonc`
declares a `custom_domain`. Add **Zone → Workers Routes → Edit** and
**Zone → DNS → Edit**. A local `wrangler deploy` will not reveal this: local
wrangler uses OAuth with full rights, so CI is the only place the gap shows.

All third-party actions **in this repository's own workflows** are pinned to
commit SHAs (`@<sha> # vX.Y.Z` comment); Renovate maintains the pins. The rule
is scoped deliberately: the `poli0981/.github` reusable workflows pin their
internal actions by **major tag** (`actions/checkout@v7`, `setup-node@v6`), and
that is the ops repo's call, not ours — do not file it as a defect here.

**Action major versions** below reflect the ops repo's verified-2026-07-06
baseline: `checkout@v7`, `setup-node@v6`, `pnpm/action-setup@v6`. Confirm the
current majors when the pins are first resolved to SHAs.

## 2. Callers to `poli0981/.github` reusable workflows

> **Inventory verified 2026-07-27** via
> `gh api repos/poli0981/.github/contents/.github/workflows`. The ops repo
> publishes `reusable-web-react.yml`, `reusable-codeql.yml` and
> `announce-release.yml`. There is **no `reusable-node-ci.yml`** and **no
> `reusable-notify.yml`** — earlier drafts of this doc called both, which
> would have failed on the first CI run. Re-check the listing before adding
> any new caller.

`.github/workflows/ci.yml` — **self-contained, two jobs (`build`, `gates`).**

It is deliberately NOT a caller. An earlier version delegated to
`reusable-web-react.yml` and every run ended in `startup_failure`, for two
independent reasons:

1. That workflow's Pages-deploy job declares `pages: write` and
   `id-token: write`. A caller cannot request less than a called workflow
   needs, so GitHub rejected the run before any step — even though the job is
   skipped by `deploy-pages: false`. Granting them would hand a
   Workers-deployed site the ability to mint OIDC tokens it never uses.
2. It runs lint / typecheck / test **only if a matching package script
   exists**. Rename a script and CI silently stops checking while still going
   green. This project's gates *are* the product, and it has already shipped
   four separate silent no-ops (a dead `set:html` lint rule, workbox globs
   matching nothing, an unregistered service worker, CSP-dropped inline
   styles). A quietly-skipping CI is the wrong tool here.

The duplicated "logic" is six `pnpm` invocations — a fair price for a gate that
fails loudly. Jobs:

- **`build`** — `pnpm lint`, `check`, `test`, `build`, then **`check:styles`**
  (must run after `build`; it inspects `dist/`) and `knip`.
- **`gates`** — `validate:data`, `i18n:check`, `osv-scanner`, `pnpm audit
  --prod`, and on PRs the changed-files lychee sweep.

Two action references that do not work the obvious way: the OSV scanner lives
in a **subdirectory** of its repo and publishes **no rolling major tag**, so it
is `google/osv-scanner-action/osv-scanner-action@v2.3.8` — `@v2` does not
resolve at all.

`.github/workflows/codeql.yml` — `reusable-codeql.yml` **does** exist (verified
2026-07-27). Two things it is easy to get wrong, both fatal at startup:

- `languages` is a **JSON array string** — it is fed to `fromJSON()` for a
  matrix. `'["javascript-typescript"]'`, not `javascript-typescript`.
- the caller must grant **`packages: read`** (CodeQL fetches query packs) on
  top of the obvious three.

```yaml
name: codeql
on:
  push: { branches: [main] }
  schedule: [{ cron: '31 3 * * 1' }]
permissions:
  actions: read
  contents: read
  packages: read          # easy to miss — reusable workflow declares it
  security-events: write
jobs:
  codeql:
    uses: poli0981/.github/.github/workflows/reusable-codeql.yml@main
    with: { languages: '["javascript-typescript"]' }
```

`.github/workflows/notify.yml` (tagged release → Discord announcement):

```yaml
name: notify
on:
  release: { types: [published] }
  workflow_dispatch:
    inputs:
      tag: { required: true, type: string }
permissions:
  contents: read
jobs:
  announce:
    uses: poli0981/.github/.github/workflows/announce-release.yml@main
    secrets: inherit   # DISCORD_RELEASES_WEBHOOK / _REPO_WEBHOOK / _PING_ROLE_ID
```

**Scope note.** This fires once per *tagged release* and reaches **Discord
only** — that is all `announce-release.yml` does. The multi-platform
`notify.py` cross-poster (Telegram / Bluesky / Mastodon / X / Facebook) is
deliberately **not wired here**: it consumes `/rss.xml` on its own cron in its
own repo (docs/03 §7, docs/13 §5). Per-app announcements therefore need no
workflow in this repository — only a valid, deterministic feed.

## 3. Deploy & previews (Cloudflare git integration)

There are **no deploy or preview workflows in this repo**. Cloudflare Workers
Builds is connected to the GitHub repository and owns both:

| Trigger | What happens |
|---|---|
| push to `main` | Cloudflare builds and deploys to `softharbor.net` |
| pull request | Cloudflare builds a preview and reports it on the PR |

Rollback stays where it was: dashboard → the Worker → **Deployments** → promote
a previous version, or `wrangler rollback` locally.

Preview URLs remain unlisted, short-lived and carry no sitemap; the indexing
risk is accepted, and a static `_headers` file cannot vary `X-Robots-Tag` by
host (docs/16 §3). Never link one publicly.

**Do not re-add a `deploy.yml`.** Two pipelines racing on the same Worker is
worse than either alone, and the token a workflow would need carries zone-level
write scopes that nothing else in this repo requires (§1).

## 4. Quarantine workflow (repo-local)

`.github/workflows/quarantine.yml` — enforces hard rule 5 mechanically:

```yaml
name: quarantine
on:
  push: { branches: [main], paths: ['src/data/apps/**'] }
  schedule: [{ cron: '17 2 * * *' }]
  workflow_dispatch:
permissions:
  contents: write
  issues: write
  pull-requests: write
jobs:
  sweep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<pinned-sha> # v4
      - uses: actions/setup-node@<pinned-sha> # v4
        with: { node-version: 24 }
      - id: sweep
        run: node scripts/quarantine.mjs   # moves flagged files, writes summary
      - if: steps.sweep.outputs.moved != ''
        uses: peter-evans/create-pull-request@<pinned-sha> # v7
        with:
          branch: quarantine/auto
          title: 'data: quarantine flagged entries'
          commit-message: 'data: quarantine ${{ steps.sweep.outputs.moved }}'
          labels: security, quarantine
          body: |
            Automated sweep: entries with `security.status: "flagged"` moved
            to `data/quarantine/`. Evidence & discussion in the linked issue.
      - if: steps.sweep.outputs.moved != ''
        uses: actions/github-script@<pinned-sha> # v7
        with:
          script: | # open one tracking issue per moved slug (title: [quarantine] <slug>)
            …
```

`scripts/quarantine.mjs`: scans `src/data/apps/*.json`, for each
`status === 'flagged'` performs `git mv` to `data/quarantine/`, emits
`moved` output (space-separated slugs). Idempotent; exits 0 when nothing to
do. The PR (not direct push) keeps a human in the loop on `main` while the
nightly cron guarantees a flagged entry never survives more than 24 h even
if a PR reviewer missed it.

**Repo setting required (action item H10).** `peter-evans/create-pull-request`
fails — even with the correct `permissions:` block — unless *Settings → Actions
→ General → **Allow GitHub Actions to create and approve pull requests*** is
enabled. Without it the nightly sweep silently cannot open its PR, which
defeats hard rule 5.

## 5. Link check (repo-local)

`.github/workflows/link-check.yml`:

```yaml
name: link-check
on:
  schedule: [{ cron: '43 4 * * 1' }]
  workflow_dispatch:
permissions:
  contents: read
  issues: write
jobs:
  lychee:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<pinned-sha> # v7
      - run: node scripts/extract-urls.mjs > /tmp/urls.txt   # all links.* from data
      - uses: lycheeverse/lychee-action@<pinned-sha> # v2
        with:
          args: --max-concurrency 4 --retry-wait-time 2 /tmp/urls.txt
          fail: false
      - uses: peter-evans/create-issue-from-file@<pinned-sha> # v5
        if: env.lychee_exit_code != 0
        with: { title: 'link-check: broken official links', path: ./lychee/out.md, labels: 'link-rot' }
```

PR-time link checking covers only files changed in the PR. It runs as the last
two steps of `ci.yml`'s **`gates` job** (§2) — *not* inside the reusable-workflow
call, which cannot accept extra steps. The weekly job above owns the full sweep.

## 6. Dependency & scanning automation

`renovate.json`:

```jsonc
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:best-practices", ":pinAllExceptPeerDependencies",
              "helpers:pinGitHubActionDigests"],
  "schedule": ["before 6am on monday"],
  "packageRules": [
    { "groupName": "minor+patch", "matchUpdateTypes": ["minor", "patch"] },
    { "matchUpdateTypes": ["major"], "dependencyDashboardApproval": true }
  ]
}
```

Plus `osv-scanner` (`google/osv-scanner-action`, lockfile mode) and
`pnpm audit --prod`, both as steps of `ci.yml`'s **`gates` job** (§2) — again,
not inside the reusable-workflow call. Critical findings fail the PR
(policy docs/01 §5).

## 7. Issue forms

`.github/ISSUE_TEMPLATE/bug_report.yml` — field `id`s are load-bearing:
they are the prefill query params used by `issueUrl.ts` (docs/05 §A6).
**Renaming an id is a breaking change to shipped clients.**

```yaml
name: Bug report
description: Something on the site is broken
labels: [bug]
body:
  - type: input
    id: page-url
    attributes: { label: Page URL }
    validations: { required: true }
  - type: textarea
    id: what-happened
    attributes: { label: What happened / expected }
    validations: { required: true }
  - type: input
    id: environment
    attributes: { label: Browser & OS, description: Auto-filled when you use the in-site button }
  - type: textarea
    id: console-output
    attributes: { label: Console output, render: shell, description: Auto-filled; feel free to trim }
```

`.github/ISSUE_TEMPLATE/app_request.yml`:

```yaml
name: App request
description: Suggest software for the directory
labels: [app-request]
body:
  - type: input
    id: app-name
    attributes: { label: App name }
    validations: { required: true }
  - type: input
    id: homepage
    attributes: { label: Official homepage (https) }
    validations: { required: true }
  - type: dropdown
    id: pricing
    attributes: { label: Pricing, options: [Free, Free + optional one-time purchase, One-time purchase] }
    validations: { required: true }
  - type: checkboxes
    id: platforms
    attributes:
      label: Platforms
      options: [{ label: Windows }, { label: macOS }, { label: Linux }]
  - type: checkboxes
    id: criteria
    attributes:
      label: Inclusion criteria (docs/00 §3)
      options:
        - { label: 'Not subscription-only (free tier is self-sufficient, or one-time purchase)', required: true }
        - { label: 'Links above are the developer''s official pages', required: true }
        - { label: 'Actively maintained or stable-and-finished', required: true }
```

`.github/ISSUE_TEMPLATE/config.yml`: `blank_issues_enabled: false`, contact
link → Discussions (or the gaming Discord) for general questions.

## 8. Branch protection (repo settings — H1 follow-up)

`main`: require PR, require linear history, dismiss stale approvals on push.
Required status checks — name **both** `ci` jobs, not the workflow: `ci / build`,
`ci / gates`, plus `codeql`. Naming only the workflow leaves the `gates` job
(validate:data, i18n parity, osv-scanner, link check) unenforced.

CODEOWNERS: `* @poli0981` with explicit entries for `.github/**`, `scripts/**`,
`src/data/**` (T6).
