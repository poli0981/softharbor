# 12 — CI/CD & Repo Automation

## 1. Overview

```
PR ──▶ ci (job build → ops reusable; job gates → local) ──▶ review ──▶ squash to main
                                                        │
                     ┌──────────────────────────────────┤
                     ▼                                  ▼
             deploy.yml (wrangler)              quarantine.yml (paths)
PR ──▶ preview.yml (versions upload → comment)
cron ─▶ link-check.yml (weekly) · quarantine.yml (nightly) · codeql · renovate
```

Secrets (action item H3): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
Everything else uses the default `GITHUB_TOKEN` with **explicit least
`permissions:` blocks in every caller** — the Phase-5 lesson: a caller stub
without its own `permissions:` block silently defaults to `none` and the
reusable workflow fails.

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

`.github/workflows/ci.yml` — **two jobs.** Despite its name,
`reusable-web-react.yml` is a generic Node CI: it accepts
`package-manager: 'npm' | 'pnpm'` and runs lint / typecheck / test / build
when the matching package script exists. But it exposes **no generic `run:`
input**, and a job that delegates with `uses:` cannot interleave extra steps —
so SoftHarbor's own gates live in a second, sibling job in the same file.

```yaml
name: ci
on:
  pull_request:
  push: { branches: [main] }
permissions:
  contents: read
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  # Cancel superseded PR runs; let main runs finish.
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
jobs:
  # Lint + test + build, via the shared workflow.
  build:
    uses: poli0981/.github/.github/workflows/reusable-web-react.yml@main
    with:
      node-version: '24'
      package-manager: pnpm
      build-command: pnpm build
      test-command: pnpm test
      deploy-pages: false        # we deploy to Workers, not Pages (§3)

  # SoftHarbor-specific gates — cannot live inside the call above.
  gates:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<pinned-sha> # v7
      - uses: pnpm/action-setup@<pinned-sha> # v6
      - uses: actions/setup-node@<pinned-sha> # v6
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm validate:data        # L2 cross-file rules, docs/03 §2
      - run: pnpm i18n:check           # EN/VI key parity, docs/07 §3
      - uses: google/osv-scanner-action@<pinned-sha> # lockfile mode, docs/01 §5
      - run: pnpm audit --prod
      # PR-time link check, changed data files only (full sweep: §5).
      - if: github.event_name == 'pull_request'
        run: node scripts/extract-urls.mjs --changed > /tmp/urls.txt
      - if: github.event_name == 'pull_request'
        uses: lycheeverse/lychee-action@<pinned-sha> # v2
        with: { args: '--max-concurrency 4 /tmp/urls.txt' }
```

Keep the caller thin: if the reusable's interface changes, adapt `with:` —
never fork its logic locally. The `gates` job is ours and stays ours.

`.github/workflows/codeql.yml` — `reusable-codeql.yml` **does** exist (verified
2026-07-27). Its `languages` input is a **JSON array string**, because the
workflow feeds it to `fromJSON()` for its matrix: `'["javascript-typescript"]'`,
not `javascript-typescript`. A bare value dies with `startup_failure` before
any step runs. **Permissions matrix (required):**

```yaml
name: codeql
on:
  push: { branches: [main] }
  schedule: [{ cron: '31 3 * * 1' }]
permissions:
  actions: read
  contents: read
  security-events: write
jobs:
  codeql:
    uses: poli0981/.github/.github/workflows/reusable-codeql.yml@main
    with: { languages: javascript-typescript }
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

## 3. Deploy & previews (repo-local)

`.github/workflows/deploy.yml`:

```yaml
name: deploy
on:
  push: { branches: [main] }
concurrency: { group: deploy, cancel-in-progress: false }
permissions:
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<pinned-sha> # v7
      - uses: pnpm/action-setup@<pinned-sha> # v6
      - uses: actions/setup-node@<pinned-sha> # v6
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: cloudflare/wrangler-action@<pinned-sha> # v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

`.github/workflows/preview.yml` (same-repo PRs only — secrets are not
exposed to forks, and fork PRs here are data PRs that don't need previews):

```yaml
name: preview
on:
  pull_request: { branches: [main] }
permissions:
  contents: read
  pull-requests: write
jobs:
  preview:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      # …same setup/build steps as deploy…
      - id: upload
        uses: cloudflare/wrangler-action@<pinned-sha> # v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: versions upload
      - uses: actions/github-script@<pinned-sha> # v7
        with:
          script: |
            const url = `${{ steps.upload.outputs.deployment-url }}`;
            github.rest.issues.createComment({ ...context.repo,
              issue_number: context.issue.number,
              body: `🔍 Preview: ${url}` });
```

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
