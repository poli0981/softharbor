# 12 — CI/CD & Repo Automation

## 1. Overview

```
PR ──▶ ci (build + gates) + codeql ──▶ review ──▶ squash (signed) to main
                                                       │
                     ┌─────────────────────────────────┤
                     ▼                                 ▼
      Cloudflare Workers Builds            quarantine.yml (paths)
      (git integration — NOT a workflow)
      queued ─▶ build ─▶ deploy ─▶ verify production (docs/13 §3)
cron ─▶ link-check (weekly) · quarantine (nightly) · codeql (weekly)
        · Dependabot (weekly, Mon)
release published ─▶ notify.yml ─▶ Discord
```

**Deployment is not a GitHub workflow.** The repository is connected to
Cloudflare via the Workers dashboard git integration (Workers Builds), which
builds with `pnpm run build` and deploys with `npx wrangler deploy` on every
push to `main`, and builds PR previews with `wrangler versions upload`.
`deploy.yml` and `preview.yml` were removed on 2026-07-28: they duplicated
that pipeline, and they failed anyway — the API token they used carries
Workers scopes but not **Zone → Workers Routes → Edit** / **Zone → DNS →
Edit**, which `wrangler deploy` needed while `wrangler.jsonc` declared a
`custom_domain` (`Authentication error [code: 10000]`). The dashboard
integration deploys with account-level credentials and has no such gap.

Consequences worth knowing:

- `wrangler.jsonc` is still the source of truth for the Worker, its bindings
  and asset handling — Workers Builds runs `wrangler deploy` against it. It
  declares **no routes** since 2026-07-28: the two custom domains are
  attached in the dashboard (docs/16 §3), and a deploy leaves them alone.
- **Workers Builds runs one build at a time.** After a burst of PR pushes a
  `main` merge can wait ~20 minutes before its build starts; superseded
  queued builds of `main` may be skipped (observed 2026-10-21: `ff95578`
  never deployed, `3743cfb` did). The "Workers Builds" check run appears on
  a `main` commit only once its build starts. Hence the release step: wait
  for that check to go green, *then* verify production (§3, docs/13 §3).
- The **build environment is Cloudflare's**, not a GitHub runner. It must
  match `.nvmrc` (Node 26 since 2026-10-23 — downloaded per build, the image
  preinstalls 22 and 24) and `packageManager` (pnpm 11), or the deployed
  output can differ from what CI validated. CI runs the same `pnpm build`
  composite, so the gates are identical; verify after any toolchain bump
  (docs/13 §2). Node 25+ ships no Corepack — if a build ever cannot find
  pnpm, set the Workers Builds variable `PNPM_VERSION=11.15.1`.
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets (action item
  H3) were **deleted** — not present on 2026-10-23, when the repository's
  Actions secrets were `DISCORD_RELEASES_WEBHOOK`, `SONAR_TOKEN` and
  `VT_API_KEY`. No workflow deploys.
- A local `pnpm deploy` (build + `wrangler deploy`) still works for the
  maintainer, but it bypasses `ci` — and **must never run while Workers
  Builds builds are queued**: a queued older build would land after it and
  roll production back. Prefer merging.

Everything else uses the default `GITHUB_TOKEN` with **explicit least
`permissions:` blocks in every workflow** — the repository's default
workflow token is read-WRITE (Settings → Actions → Workflow permissions), so
a workflow without the block would get far more than it needs. Workflows
declare `contents: read` at the top and grant more per job only where
needed (quarantine). Checkouts use `persist-credentials: false`. The
Phase-5 lesson still applies to callers of reusable workflows: a caller stub
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

**`CLOUDFLARE_API_TOKEN` needs zone scopes, not just Workers** (moot while
no workflow deploys — kept for the day one does). The "Edit Cloudflare
Workers" template alone fails with `Authentication error [code: 10000]` on
`/zones/…/workers/routes` whenever `wrangler.jsonc` declares a
`custom_domain`. Add **Zone → Workers Routes → Edit** and **Zone → DNS →
Edit**. A local `wrangler deploy` will not reveal this: local wrangler uses
OAuth with full rights, so CI is the only place the gap shows.

All third-party actions **in this repository's own workflows** are pinned to
full commit SHAs with the release in a comment (`@<sha> # vX.Y.Z`,
SonarCloud `githubactions:S7637`); Dependabot's `github-actions` ecosystem
bumps the SHA and the comment together (§6). The rule is scoped
deliberately: first-party org workflows (`poli0981/.github`) are tracked at
`@main` so org-wide fixes land everywhere at once, and how *they* pin their
internal actions is the ops repo's call — do not file it as a defect here.

Pinned as of 2026-10-23: `actions/checkout` v7.0.1 · `pnpm/action-setup`
v6.1.0 (no `version:` — it reads `packageManager`) · `actions/setup-node`
v7.1.0 (`node-version-file: .nvmrc`) · `actions/cache` v6.1.0 ·
`actions/upload-artifact` v7.0.2 · `google/osv-scanner-action` v2.7.0 ·
`lycheeverse/lychee-action` v2.9.0 · `peter-evans/create-pull-request`
v8.1.1 · `SonarSource/sonarqube-scan-action` v8.3.0 (with
`scannerVersion: 8.2.0.6438`, the newest CLI — Dependabot bumps the action,
not that input; the deprecated `sonarcloud-github-action` must not come
back).

## 2. Callers to `poli0981/.github` reusable workflows

> **Inventory verified 2026-07-27** via
> `gh api repos/poli0981/.github/contents/.github/workflows`. The ops repo
> publishes `reusable-web-react.yml`, `reusable-codeql.yml` and
> `announce-release.yml`. There is **no `reusable-node-ci.yml`** and **no
> `reusable-notify.yml`** — earlier drafts of this doc called both, which
> would have failed on the first CI run. Re-check the listing before adding
> any new caller.

`.github/workflows/ci.yml` — **self-contained, three jobs (`build`, `gates`, `sonar`).**

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

The duplicated "logic" is a handful of `pnpm` invocations — a fair price for a
gate that fails loudly. Triggers: `pull_request`, `push` to `main`, and
`workflow_dispatch` (so `quarantine.yml` can run the required checks on the
PR it opens — §4). Top-level `permissions: contents: read`; concurrency
cancels superseded runs except on `main`. Jobs:

- **`build`** (25 min cap) — install (frozen lockfile) → `pnpm lint`
  (ESLint + Prettier) → `pnpm check` (types) → **`pnpm coverage`** (the unit
  run itself, failing below the thresholds in `vitest.config.ts`) →
  **`pnpm build`** — the *same* command Workers Builds runs, carrying its own
  gates: `validate:data → i18n:check → astro build → postbuild:html →
  check:csp → check:assets → check:sw → check:feed` → **`wrangler deploy
  --dry-run`** (bundles `worker/` and validates `wrangler.jsonc` — bindings,
  assets, `run_worker_first` — without credentials) → `pnpm knip` →
  **Playwright e2e** on that build (docs/11 §5) — `astro preview` for the
  pages, `wrangler dev` for the Worker and its rate limits; the Chromium
  download is cached per Playwright version (on a hit only the OS libraries are
  installed), and the HTML report is uploaded as an artifact (7 days) when
  the job fails.
- **`gates`** (15 min cap) — `validate:data`, `i18n:check`, `osv-scanner`
  (lockfile mode), `pnpm audit --prod`, and on PRs the changed-files lychee
  sweep (§5).
- **`sonar`** (20 min cap, **not** a required check — a SonarQube Cloud outage
  must never block a merge) — CI-based analysis since 2026-10-23, replacing
  Automatic Analysis (which cannot import coverage, and which must stay off:
  a CI scan fails while it is on). Full-history checkout (blame and the
  new-code period need it) → install → `pnpm coverage` →
  `SonarSource/sonarqube-scan-action` with `scannerVersion` pinned to the
  newest SonarScanner CLI, `-Dsonar.projectVersion=<package.json version>`
  (the project's new-code period is "previous version", so new code on
  `main` is everything since the last release) and
  `-Dsonar.qualitygate.wait=true`, so a failed **Sonar way** gate turns the
  job red. Scope lives in `sonar-project.properties` (organization
  `poli0981`, project `poli0981_softharbor`): sources rooted at the repo so
  `.github/` workflows are analysed, the dataset/docs/build output excluded,
  tests (and `scripts/fixture.ts`) judged by test rules, coverage from
  `coverage/lcov.info` with only the root `*.config.*` files excluded
  (docs/11 §1). The job's `if:` reads **only** the `github` context — a
  `secrets` reference there invalidates the whole workflow, and the
  required `build`/`gates` would never appear — and skips runs that lack
  `SONAR_TOKEN`: Dependabot (separate secret store), fork PRs, and the bot
  data PRs (`workflow_dispatch`, or `github-actions[bot]`).

Two action references that do not work the obvious way: the OSV scanner lives
in a **subdirectory** of its repo and publishes **no rolling major tag**, so it
is `google/osv-scanner-action/osv-scanner-action@<sha> # v2.7.0` — `@v2` does
not resolve at all.

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
  pull_request:           # REQUIRED — its check is a required status check
  schedule: [{ cron: '31 3 * * 1' }]
  workflow_dispatch:      # quarantine.yml runs it on the PR it opens
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

`pull_request` is not optional: the ruleset lists `codeql / Analyze
(javascript-typescript)` as a required check, and a required check the
workflow never produces on a PR deadlocks the repository — no PR can merge
(hit 2026-07-30). It is also the point of the tool: scanning only after the
merge reports a vulnerability that is already on `main`.

`.github/workflows/notify.yml` (published release → Discord announcement):

```yaml
name: notify
on:
  release: { types: [published] }
  workflow_dispatch:
    inputs:
      tag: { description: Release tag to (re-)announce, required: true, type: string }
permissions:
  contents: read
jobs:
  announce:
    uses: poli0981/.github/.github/workflows/announce-release.yml@main
    with:
      # The reusable workflow reads `tag_override`, falling back to the
      # release event's tag. Without it every manual re-run died with
      # "No release tag available."
      tag_override: ${{ inputs.tag || '' }}
    secrets:
      DISCORD_RELEASES_WEBHOOK: ${{ secrets.DISCORD_RELEASES_WEBHOOK }}
```

Only the one secret the announcement needs is passed — not `secrets:
inherit`, which would hand every repository secret to code tracked at
`@main`. Publishing a release fires this, so release notes must be accurate
before they are published (docs/13 §3).

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
| push to `main` | Cloudflare queues a build (`pnpm run build`), then deploys (`npx wrangler deploy`) to `softharbor.net` — assets **and** the `/api/verify` Worker |
| pull request push | Cloudflare builds a preview version (`wrangler versions upload`) and reports its URL on the PR |

**Builds are serialized.** One build at a time across PRs and `main`; a
`main` merge after a burst of PR pushes can wait ~20 minutes, and a
superseded queued `main` build can be skipped (only the newest lands). The
"Workers Builds" check (check run `Workers Builds: softharbor`) appears on a
`main` commit only once its build starts — an absent check means "queued",
and a quiet stretch in `wrangler deployments list --name softharbor` only
means nothing reached `main`.

**After every merge** (release step, docs/13 §3): wait until the merge
commit's "Workers Builds" check is green, then verify production — new
`/_astro/` asset hashes served, the response headers, `/api/verify`
answering JSON from the Worker, `/rss.xml`. **Never run `wrangler deploy` by
hand while builds are queued**: the queued older build would land after it.

Rollback stays where it was: dashboard → the Worker → **Deployments** → promote
a previous version, or `wrangler rollback` locally (same caution about a
queue).

Preview URLs remain unlisted, short-lived and carry no sitemap, and since
v1.1 `_headers` marks them `X-Robots-Tag: noindex` with an absolute-URL host
pattern (`https://:version.:subdomain.workers.dev/*`) that the production
domain never matches (docs/16 §3). Never link one publicly.

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
  contents: read
concurrency: { group: quarantine, cancel-in-progress: false }
jobs:
  sweep:
    runs-on: ubuntu-latest
    permissions:
      contents: write        # create-pull-request commits to quarantine/auto
      pull-requests: write   # …and opens the PR
      issues: write          # one tracking issue per slug
      actions: write         # dispatch the required checks onto the PR branch
    steps:
      - uses: actions/checkout@<sha> # v7.0.1
        with: { persist-credentials: false }   # no token while repo code runs
      - uses: actions/setup-node@<sha> # v7.1.0
        with: { node-version-file: .nvmrc }
      - id: sweep
        run: node scripts/quarantine.mjs   # moves flagged files, writes `moved`
      - id: cpr
        if: steps.sweep.outputs.moved != ''
        uses: peter-evans/create-pull-request@<sha> # v8.1.1
        with:
          branch: quarantine/auto
          sign-commits: true               # the ruleset requires signed commits
          title: 'data: quarantine flagged entries'
          commit-message: 'data: quarantine ${{ steps.sweep.outputs.moved }}'
          labels: security, quarantine
      - if: steps.cpr.outputs.pull-request-branch != ''
        env: { GH_TOKEN: '${{ github.token }}', BRANCH: '${{ steps.cpr.outputs.pull-request-branch }}' }
        run: |                             # a GITHUB_TOKEN PR's own runs wait for approval
          gh workflow run ci.yml     --ref "$BRANCH"
          gh workflow run codeql.yml --ref "$BRANCH"
      - if: steps.sweep.outputs.moved != ''
        env: { GH_TOKEN: '${{ github.token }}', MOVED: '${{ steps.sweep.outputs.moved }}' }
        run: …   # per slug (validated against the slug regex): open
                 # "[quarantine] <slug>" only if no such issue is open
```

`scripts/quarantine.mjs` (also `pnpm quarantine`, for the maintainer): scans
`src/data/apps/*.json`, and for each `status === 'flagged'` **moves** the
file to `data/quarantine/` (a plain filesystem rename — git records it as a
rename when committed; the directory is created on first use). It skips
unparseable files (L1/L2's job), refuses a non-slug filename (it would reach
a workflow output, a commit message and an issue title) and never
overwrites an existing quarantined copy. Emits the `moved` output
(space-separated slugs). Idempotent; exits 0 when nothing is flagged. The
PR (not a direct push) keeps a human in the loop on `main` while the nightly
cron guarantees a flagged entry never survives more than 24 h even if a PR
reviewer missed it. Normally it never fires: `validate:data` fails a PR
that flags an entry without moving it.

Hardened 2026-10-21: a PR opened with `GITHUB_TOKEN` triggered no
`pull_request` workflows, so its required checks never ran and it could not
merge — the job now dispatches `ci.yml` and `codeql.yml` on the PR branch
(`workflow_dispatch` always runs). *Corrected 2026-10-23:* since GitHub's
2026-06-11 change such a PR **does** get `pull_request` runs, but they wait
for a maintainer's approval — the dispatch stays, and approving those runs
would only duplicate CI. The commit is **signed**
via the API (`sign-commits`). Issues are created only when none is open
(every nightly run used to re-open them). Step outputs reach shell bodies
only through `env:`, never `${{ }}` inside `run:` (expression injection).

**Repo setting required (action item H10 — enabled).**
`peter-evans/create-pull-request` fails — even with the correct
`permissions:` block — unless *Settings → Actions → General → **Allow GitHub
Actions to create and approve pull requests*** is enabled. Without it the
nightly sweep silently cannot open its PR, which defeats hard rule 5.

## 4b. VirusTotal re-check (repo-local)

`.github/workflows/vt-recheck.yml` + `scripts/vt-recheck.mjs` (added
2026-10-23, D30) — docs/09 §6 step 5 made assisted, so no dated security
claim can go stale unnoticed. Every check in the v1.0 catalogue was dated
2026-07-30, so all 326 would have crossed `validate:data`'s 180-day warning
together on 2027-01-27.

- **What it scans:** each entry's `links.download` page — the URL every
  recorded scan was of (318 of 326 evidence ids equal the SHA-256 of that
  link's canonical form; 8 had drifted to a newer link). `POST /urls`
  submits it, a second pass reads `GET /analyses/{id}`, and the permalink is
  `https://www.virustotal.com/gui/url/<sha256>`. The canonical form keeps a
  `#fragment`: the API puts it in the id (measured 2026-10-23), while the six
  2026-07-30 scans of `#download` links were submitted from a browser, which
  never sends one — those six count as drifted until their next scan.
- **What it writes:** only the three `security` lines, patched in place so
  Prettier's layout survives; never `addedAt`/`updatedAt` — the feed orders
  by `addedAt`, and notify.py announces anything it has not seen.
- **The rules:** zero malicious/suspicious ⇒ fresh `evidence` + `checkedAt`,
  status unchanged; any detection ⇒ `clean` becomes `unverified` and a
  `[vt] <slug>` issue (label `security`) asks the maintainer to decide;
  `promote` slugs go `unverified` → `clean` only on a clean scan. It never
  sets `flagged` — quarantine stays a human `pnpm quarantine` (§4). An
  analysis in which no engine answered is "not checked", not clean.
- **Who is due:** the `slugs` input first, then never-scanned entries, then
  drifted evidence (at most weekly), then checks older than `max_age`
  (default 90 days), oldest first.
- **Limits:** the Public API allows 4 requests a minute and 500 a day, and
  counts every call. The script paces at 15.5 s, spends at most `budget`
  (default 440, capped at 500) with no more than half of it on submissions,
  backs off 60 s once on a 429 and treats a second as the day's quota —
  keeping what it finished. A refused key fails the step; a missing key
  (forks, Dependabot) is a no-op that says so. `concurrency: vt-recheck`
  keeps two runs off one key. The schedule, 00:41 UTC, follows the daily
  quota reset.
- **On `main` (daily cron, or dispatch):** one PR, `vt/recheck`, opened by
  `peter-evans/create-pull-request` with `add-paths: src/data/apps` and
  API-signed commits. While it is open, each run first **carries** its
  results (`git archive` of the branch into `$RUNNER_TEMP`; a block is
  adopted only if its download link is unchanged and its check is newer), so
  the PR accumulates day by day instead of re-scanning the same entries. The
  repository deletes merged branches, and a PR closed unmerged is never
  carried. CI is dispatched on the branch when the action created or updated
  the PR (same reason as §4).
- **On any other branch (preview):** dispatch `vt-recheck.yml --ref
  <branch>` and it scans only the `slugs` given — or, with none, the entries
  without a scan, i.e. a data PR's new apps — then uploads the patched files
  and the report as the `vt-preview` artifact (7 days). No PR, no issues: the
  maintainer reviews and commits them into the data PR before it merges.
- **Terms:** VirusTotal offers the Public API to sites "free to consumers";
  it "must not be used in business workflows that do not contribute new
  files" and "can not be used as a substitute for antivirus products".
  SoftHarbor is free, carries no ads and only submits public download URLs;
  the site copy keeps making no safety claim (hard rule 4).

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
concurrency: { group: link-check, cancel-in-progress: false }
jobs:
  lychee:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha> # v7.0.1
        with: { persist-credentials: false }
      - uses: actions/setup-node@<sha> # v7.1.0
        with: { node-version-file: .nvmrc }
      - run: node scripts/extract-urls.mjs > /tmp/urls.txt   # links.* + evidence
      - id: lychee
        uses: lycheeverse/lychee-action@<sha> # v2.9.0
        with:
          args: >-
            --max-concurrency 4 --retry-wait-time 10 --max-retries 5 --timeout 45
            --accept '200..=299,403,429'
            /tmp/urls.txt
          output: ./lychee/out.md
          fail: false            # link rot is triage, not a build break
      - name: Refresh the tracking issue
        run: …   # gh: edit + comment on the ONE open "link-check: broken
                 # official links" issue (label link-rot), or create it;
                 # close it the first week the sweep is clean
```

**One tracking issue, not one per week.** The previous version opened a
fresh issue on every red run and left 12 duplicates open (#7–#20) — the
latest for a single transient 502. Now the open issue's body is replaced
with the new report and a comment links the run; a clean sweep closes it.
Retries are longer than the PR sweep's because vendor sites blip and a
weekly job has time to ride it out.

**403 and 429 count as reachable** in both sweeps (decision of 2026-07-30,
docs/15 §4): 14 of the first 26 failures were bot mitigation on plainly
live vendor sites. 404/5xx/connection failures still fail. Do **not** add
`--user-agent`: spoofing a browser cleared the 403s but made other vendors
answer 406/400.

PR-time link checking covers only the links the PR adds or edits — the URLs
on the added lines of its diff. It runs as the last two steps of `ci.yml`'s
**`gates` job** (§2): `git diff -U0` runs in the workflow under
`set -euo pipefail` and pipes into `extract-urls.mjs --added` (a failed diff
stops the job rather than silently narrowing the check), and lychee is
**skipped** when there is nothing to check — an empty input is a
configuration error to lychee, and a skipped step stays visible where a
green "0 links" would not. A new entry is all added lines, so every one of
its links is checked; a re-check PR adds only evidence URLs. *Changed
2026-10-23:* it used to check every link of every touched file
(`--changed`), and the first `vt/recheck` PR — 198 rewritten security
blocks — failed three times on ~700 unrelated vendor links (a timeout at
gitlab.linphone.org, a 522 at godotengine.org, a 520 at activitywatch.net).

## 6. Dependency & scanning automation

**Dependabot** — `.github/dependabot.yml`. It replaced `renovate.json` on
2026-10-21: Renovate was never installed on this repository (no
`renovate/*` branch, Dependency Dashboard or PR ever appeared), so for three
months nothing kept versions or action pins current, while Dependabot
*security* updates — already enabled in Settings — quietly failed on
transitive packages. One bot, configured here, instead of two.

| Ecosystem | Schedule | Policy |
|---|---|---|
| `npm` | weekly, Monday 05:00 Asia/Ho_Chi_Minh | **2-day cooldown**; `minor` + `patch` grouped (`minor-and-patch`); up to 10 open PRs; `versioning-strategy: increase`; **ignores the majors of `typescript` and `@typescript/native`** (D21 as amended — the TS 6 API wrapper and TS 7 run side by side; how Dependabot treats `npm:` aliases is ⚠ unverified) and **`@types/node` majors** (the typings track the Node major in `.nvmrc`, docs/01 §5 rule 4); commit prefixes `fix(deps)` / `chore(deps)` (dev) |
| `github-actions` | same | 2-day cooldown; all actions in one group; bumps the pinned SHA and its `# vX.Y.Z` comment together; prefix `ci` |

**Why the cooldown:** pnpm 11 refuses any release younger than its default
24 h `minimumReleaseAge`, and CI installs with `--frozen-lockfile` under that
policy — a PR opened on release day failed before a single test ran (#14,
#15). Two days keeps every update PR installable.

Plus `osv-scanner` (`google/osv-scanner-action`, lockfile mode) and
`pnpm audit --prod`, both steps of `ci.yml`'s **`gates` job** (§2), on every
PR and push to `main`; a finding fails the job (policy docs/01 §5).
CodeQL (§2) and SonarQube Cloud's CI-based analysis (`ci.yml` `sonar` job,
`sonar-project.properties` — sources rooted at the repo so `.github/`
workflows are analysed too; the dataset, docs and build output excluded;
coverage imported) complete the scanning.

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
    attributes:
      label: Official homepage (https)
      description: The developer's own domain or official repository — not a download portal.
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

`.github/ISSUE_TEMPLATE/config.yml`: `blank_issues_enabled: false`; contact
links → GitHub Discussions for questions, and **Report a security issue** →
the repository's private vulnerability reporting
(`/security/advisories/new`) — never a public issue.

## 8. Branch protection (ruleset "Run" on `main`)

`main` is protected by a repository **ruleset** ("Run"), not classic branch
protection:

- **PR required**; **0 required approvals** and code-owner review off
  (single-maintainer repository — CODEOWNERS only *requests* the review).
- **Signed commits required.** Commits are GPG-signed locally; the
  quarantine bot signs through the API (§4).
- **Linear history.**
- **Required status checks:** `build` and `gates` — the two `ci.yml` jobs,
  shown in the UI as `ci / build`, `ci / gates` — and
  `codeql / Analyze (javascript-typescript)`. Name **both** `ci` jobs, not
  the workflow: naming only the workflow leaves the `gates` job
  (validate:data, i18n parity, osv-scanner, audit, link check) unenforced.
  A required check must be produced on PRs, or nothing can merge (§2).
- Auto-merge is disabled (⚠ verify in Settings if this matters).

**Merge method: squash, and only squash.** GitHub refuses a rebase merge
under the signed-commits rule ("Rebase merges cannot be automatically signed
by GitHub"), and a merge commit breaks linear history. The squash title must
be a valid conventional commit, and the body should carry every commit
subject from the branch (docs/10 §5). Older history shows rebase merges only
because they predate the signature rule. A branch stacked on a squashed one
must be replayed with `git rebase --onto origin/main <old-branch>`.

CODEOWNERS: `* @poli0981` with explicit entries for `/.github/**`,
`/scripts/**`, `/src/data/**` and `/worker/**` (T6).
