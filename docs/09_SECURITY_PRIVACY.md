# 09 — Security & Privacy

## 1. Posture in one paragraph

A static site with no accounts, no forms, no cookies and no page-serving
server code has a small attack surface — the residual risks are **supply
chain** (our build), **data integrity** (a malicious or sloppy listing), and
**reputation** (recommending software that later turns out harmful).
Since v1.1 two deliberate additions widen it slightly and are covered
here: **one server endpoint**, `POST /api/verify` (D25, §4a), and **two
disclosed Cloudflare services** loaded by our own code — Web Analytics
(D26) and Turnstile (D25). Sections below address all of that, plus the
honest-privacy story.

## 2. Threat model

| # | Asset | Threat | Mitigation |
|---|---|---|---|
| T1 | Visitors' machines | A listed app is/becomes malware; user installs it trusting us | Inclusion criteria C5–C7; vetting checklist §6; dated `security.status` (never a guarantee — hard rule 4); quarantine pipeline (docs/03 §5); monthly re-verification (docs/13 §6); Disclaimer (docs/14 §3a) |
| T2 | Visitors | Typosquat/mirror `links.download` sneaks into a PR | Official-domain rule (hard rule 8); L4 human review compares domain to vendor's known domain; lychee catches parked/dead domains; PRs from non-maintainers never auto-merge |
| T3 | Site integrity | Supply-chain compromise of a dependency poisons the build | §7: frozen lockfile, `allowBuilds` allowlist, Dependabot + osv-scanner + `pnpm audit`, SHA-pinned actions, CodeQL + SonarCloud, minimal dependency count |
| T4 | Site integrity | XSS via data fields | All rendering through Astro's default escaping; `set:html` lint-banned (`astro/no-set-html-directive`) except five named files that inline build-time SVG, JSON-LD or one constant (docs/10 §3); JSON-LD escapes `<`; schema constrains URLs to https; CSP §4 as backstop |
| T5 | Visitors | Clickjacking / framing on a look-alike site | `frame-ancestors 'none'` + `X-Frame-Options: DENY` (and on Worker responses, §4a) |
| T6 | Repo | Malicious PR alters workflows/scripts/the Worker | Ruleset on `main`: PR required, **signed commits**, required checks (docs/12 §8); CODEOWNERS on `.github/**`, `scripts/**`, `src/data/**`, `worker/**`; every workflow declares least `permissions:` (the repo default token is read-write); `persist-credentials: false` on checkout; step outputs reach shell only via `env:` (no `${{ }}` in `run:`) |
| T7 | Availability | DDoS, floods, runaway scrapers | Cloudflare's edge DDoS protection absorbs volumetric attacks before any code runs. Above that, the Worker's site-wide limit (D32, docs/08 Part F): 60 requests per 10 s per IPv4 or IPv6 /64 for every page, feed and data file, answered with our own 429 page or JSON; optional zone rule as an outer layer (docs/16 §9.1). The files a page loads are never limited, so a page that passed loads whole; the limit and `/api/verify` both fail open, so an outage of either locks nobody out (§4a) |
| T8 | Users' privacy | Tracking/leakage | No cookies, no ads, no fingerprinting by us. Two Cloudflare services only, both started by our code: Web Analytics (cookieless; never under Global Privacy Control or off the production host) and Turnstile (only after the documents are accepted). The CSP allows exactly their origins (§4); storage inventory §8 |
| T9 | The domain itself | `softharbor.net` hijack (registrar/DNS) or email spoofing "from" the domain | Registrar transfer lock + auto-renew, DNSSEC enabled, zone changes only via the dashboard (custom domains are attached there, docs/16 §3); SPF + DMARC `p=quarantine` observed 2026-10-21 (→ `reject` planned) — docs/16 §2/§6 |
| T10 | The endpoint | `/api/verify` abused: cross-site POSTs, replayed or foreign tokens, oversized bodies, burning the Siteverify allowance | Same-origin check; `application/json` only; body ≤ 4 KB counted while streaming; token ≤ 2048 chars; Siteverify verdict re-checked for host, `action: legal_gate` and age ≤ 300 s; idempotency key; Workers Rate Limiting 20/60 s per IPv4 or IPv6 /64; `no-store` — all in §4a |
| T11 | Visitors | A compromised third-party script (the analytics beacon or Turnstile's `api.js`) | Loaded by our code only, from exactly two CSP-listed origins; analytics never on previews, localhost or under GPC; Turnstile only after acceptance and inside its own iframe. No Subresource Integrity — both are unversioned URLs Cloudflare updates in place — so this is an **accepted** dependency on Cloudflare, the host we already trust with every byte |

## 3. Non-existent surfaces (by design)

No auth, no sessions, no cookies, no file uploads, no comments, no
database. **One** server input exists since v1.1: the JSON body of
`POST /api/verify` — at most 4 KB, one string field, read only to be
forwarded to Siteverify (§4a). Keep it that way: any feature that adds one
of these — or a second server input — requires a threat-model update in
this file first, and a decision-log entry (hard rule 1).

## 4. HTTP headers & CSP

`public/_headers` (Workers Static Assets applies it natively):

```
/*
  Content-Security-Policy: frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

/_astro/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable

/api/apps.json
  ! Cache-Control
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300

/search-index.json
  ! Cache-Control
  Cache-Control: public, max-age=300

# RFC 9116 §3: text/plain WITH charset=utf-8
/.well-known/security.txt
  Content-Type: text/plain; charset=utf-8

# PR preview versions (docs/16 §3); never matches the custom domain
https://:version.:subdomain.workers.dev/*
  X-Robots-Tag: noindex
```

**`/*` sets no `Cache-Control`, and every specific rule detaches with
`! Cache-Control` first** (fixed 2026-10-21). Cloudflare applies *every*
matching rule and **joins** a header set by several of them with a comma —
it does not override. With the old `/*` value, hashed assets were served
`public, max-age=0, must-revalidate, public, max-age=31536000, immutable`;
browsers honour the first `max-age` (RFC 9111 even says to treat
conflicting directives as stale), so every "immutable" asset was
revalidated on every load and the JSON feeds were never cached. HTML,
`sw.js` and the manifest still get `public, max-age=0, must-revalidate` —
Cloudflare's own default for static assets. `_headers` applies only to
asset responses; the Worker sets its own headers (§4a).

**There is no `/fonts/*` rule.** Astro content-hashes the self-hosted fonts
into `/_astro/` along with JS and CSS, so the `/fonts/*` rule earlier drafts
carried matched nothing (verified in M1: `dist/` contains 13 `.woff2` files,
all under `_astro/`). The `/_astro/*` rule above already gives them the right
`immutable` treatment — and correctly so, since they *are* content-hashed.

Notes:

- **The CSP is split between a header and a meta tag (decision D20,
  supersedes D18).** Settled empirically in spike S1, 2026-07-27:
  - `<ClientRouter />` compiles to an **external** module script — it was
    never the problem. (It is gone anyway since v1.1: Astro does not
    support ClientRouter together with `security.csp`, and a soft
    navigation kept the *first* page's meta policy — docs/02 §6.)
  - **Astro's island hydration is.** Every `client:*` directive emits inline
    bootstrap scripts into that page's HTML. With six islands (docs/02 §5)
    that is effectively every page, so the D18 plan — "ship nothing inline,
    use plain `script-src 'self'`" — is **not achievable**. Verified: the
    probe page with one `client:idle` island carried two inline scripts; the
    page without an island carried none.
  - The fix is Astro's own `security.csp` (stable in Astro 7, configured in
    `astro.config.ts`). It hashes the snippets **it** generates and emits a
    per-page `<meta http-equiv="content-security-policy">` carrying
    `script-src`/`style-src` plus our other directives. No hand-maintained
    hash list, no `emit-csp.mjs`, no placeholder to forget — which was B4's
    real complaint.
- **The policy (v1.1)**, emitted on every page:
  `default-src 'self'; img-src 'self' data:; font-src 'self';
  connect-src 'self' https://cloudflareinsights.com;
  frame-src https://challenges.cloudflare.com; manifest-src 'self';
  base-uri 'none'; form-action 'none'; object-src 'none'`, plus
  `script-src 'self' https://static.cloudflareinsights.com
  https://challenges.cloudflare.com` + Astro's hashes, and
  `style-src 'self'` + hashes. The two Cloudflare origins are D26 (beacon
  script + beacon POST) and D25 (Turnstile `api.js` + its iframe) — nothing
  else third-party, and adding an origin needs a decision-log entry (hard
  rule 7). `scriptDirective.resources` **replaces** Astro's default list, so
  `'self'` is spelled out or every same-origin script, islands included,
  would be refused. `styleDirective.hashes` adds the one style Astro cannot
  hash itself: the inline View Transitions opt-in (`src/lib/inlineCss.ts`,
  docs/02 §6).
- **The meta tag comes first.** A meta-tag CSP governs only what the parser
  meets *after* it, and Astro appends its tag at the end of `<head>` —
  behind `errors.js`, `theme.js`, `registerSW.js` and the analytics loader.
  `scripts/postbuild.mjs` (`pnpm postbuild:html`) moves it to directly after
  `<meta charset="utf-8">` on every page, so nothing in the document
  precedes the policy meant to cover it. Our head scripts are external,
  content-hashed `/_astro/` files (docs/02 §4) — covered by `'self'`, no
  hash needed.
- **`_headers` must therefore carry only `frame-ancestors`.** A header CSP
  and a meta CSP are enforced as **two separate policies**, and a resource
  must satisfy both — so a `script-src 'self'` in `_headers` would intersect
  with the meta policy, drop Astro's hashes, and break every island.
  `frame-ancestors` is the one directive that must stay in the header,
  because meta-tag CSP ignores it by spec. `X-Frame-Options: DENY` backs it up.
- **Verification is a build gate: `pnpm check:csp`** (`scripts/check-csp.mjs`,
  formerly `check-no-inline-styles` / `check:styles`), run inside
  `pnpm build` after `postbuild:html`. For every page in `dist/**/*.html` it
  fails on: **no CSP meta** at all (formerly a silent skip), **any
  `<script>` before the meta**, any `<style>` element whose SHA-256 is not
  in that page's own policy, any inline `<script>` body not in it (JSON-LD
  data blocks excepted), and **any `style` attribute** in any of HTML's
  three quoting forms. Then the e2e suite loads real pages in Chromium and
  fails on any `securitypolicyviolation` event (docs/11 §5), and in the
  field `errors.js` records violations into bug reports (docs/05 §A5) —
  a meta policy cannot carry `report-uri`/`report-to`, so that event is the
  only signal there is. **Check against `astro preview`, never `astro
  dev`**: the dev server emits no CSP meta, so a check there returns a false
  clean.
- **Residual weakness, accepted:** Astro puts the union of known hashes in
  every page's policy (2026-10-21 build: 7 script and 3 style hashes on
  every page, of which `/` uses 4 and 2, a legal page 3 and 2). Still
  hash-pinned, never `'unsafe-inline'` — just less tight per page than it
  could be.
- **JSON-LD** (`<script type="application/ld+json">`) is a data block, not an
  executable script, so it needs no hash under `script-src` (docs/16 §7).
  `astro/no-unsafe-inline-scripts` bans hand-written inline script bodies in
  source; JSON-LD is allowed by that rule's defaults.
- **`style-src` bans inline `style` ATTRIBUTES, not just `<style>` blocks.**
  Hashes do not apply to attributes — only `'unsafe-hashes'` or
  `'unsafe-inline'` would permit them, and the policy has neither. So any
  `style="…"` in a component is **silently dropped by the browser**: the build
  passes, the source looks right, and the declaration simply is not there. That
  is how the sticky header shipped fully transparent, letting page content bleed
  through it (found 2026-07-28, after ~49 inline styles had accumulated).
  Every design token is therefore exposed as a Tailwind utility
  (`text-sh-muted`, `bg-sh-surface`, `border-sh-control`) in
  `src/styles/global.css`, and **`pnpm check:csp` fails the build if any
  `style=` reaches `dist/`**. The same applies to **runtime** writes: an
  `el.style.*` assignment is refused too and no build check can see it —
  that is how sorting broke in production (docs/05 §A3); code never writes
  `el.style`. Do not relax the policy to fix a styling bug.
- **Turnstile's iframe has its own CSP** and logs violations for probes it
  makes itself (`*.challenges.cloudflare.com` hosts). Those messages come
  from inside Cloudflare's frame, cannot be fixed from the page, and the e2e
  fixture ignores them; do not loosen ours in response.
- `Strict-Transport-Security` is deliberately **absent from `_headers`**:
  it is configured once at the zone level with a phased max-age rollout
  (docs/16 §5) so it also rides on redirect responses. Keeping it out of
  `_headers` avoids two sources of truth with conflicting `max-age`.
- `Access-Control-Allow-Origin: *` only on the intentionally-public dataset.
- Verify after every deploy touching `_headers` or the CSP (full block:
  docs/16 §10) — the header CSP must be exactly `frame-ancestors 'none'`,
  the meta policy must list the two Cloudflare origins, one hashed asset
  must carry a single `Cache-Control` — plus an observatory scan
  pre-launch (docs/13 §2):

  ```bash
  curl -sI https://softharbor.net/ | grep -iE 'content-security|frame|referrer|cache-control'
  curl -s  https://softharbor.net/ | grep -o '<meta http-equiv="content-security-policy"[^>]*>'
  ```

## 4a. The human check (`POST /api/verify`, D25)

Step 2 of the legal gate (docs/14 Part 2): after a visitor accepts the
documents, Cloudflare Turnstile checks that a person — not a bot — is
there, and the site's one Worker confirms the result with Cloudflare's
Siteverify. Endpoint mechanics, statuses and secrets: docs/08 Part E; the
client algorithm and timings: docs/05 §A9.

**What it is for — and what it is not.** It filters automated traffic
politely; it is **not a lock**. SoftHarbor is a public static site: every
page is served without asking, and the verdict only decides whether the
gate remembers the visitor as checked (`sh:human`, 48 h) or lets them
through unchecked (1 h). Every failure on our side — no secret, Siteverify
down, rate limit hit, script blocked, timeout — **fails open**. A person is
never locked out by an outage, and a bot that defeats it gains nothing a
`curl` of the static pages would not already give it.

**Consent first.** Turnstile's `api.js` is requested only after the
visitor accepts the Privacy Policy that describes it — never before (the
e2e suite asserts that no Cloudflare request precedes acceptance).

**Server-side checks** (`worker/verify.ts`, `worker/http.ts`):

- **Same-origin only** — `Origin` must equal the origin the request arrived
  on (so previews and `wrangler dev` work without a host list).
- **`Content-Type: application/json` exactly** — `text/plain` and form
  encodings, which a cross-site form or a no-preflight `fetch` can send, are
  refused (`415`).
- **Bounded input** — `Content-Length` ≤ 4096 when declared, and the body is
  *counted while it streams*, so a body without a length is never buffered
  past the cap (`413`); `token` must be a non-empty string ≤ 2048 chars.
- **The verdict is re-checked, not trusted** — Siteverify's `success` plus
  `hostname` equal to the request's host (a token minted on another site is
  refused), `action` equal to `legal_gate` (a token minted for another
  purpose is refused) and `challenge_ts` at most 300 s old.
- **Replay-safe retry** — one retry on a network error or 5xx, with the
  *same* idempotency key, so the retry is answered instead of reporting the
  single-use token as spent.
- **Rate limit** — Workers Rate Limiting, 20 verifications per 60 s per
  IPv4 address or IPv6 /64 (a host can rotate through its /64), per
  Cloudflare location; generous because a school or office shares one NAT
  address. Over the limit → `429` + `Retry-After: 60` → the gate fails open.
- **Responses** — JSON, `Cache-Control: no-store`, and their own security
  headers (`default-src 'none'; frame-ancestors 'none'` CSP, CORP
  same-origin, `nosniff`, Referrer-Policy): `_headers` never applies to
  Worker responses.

**Privacy.** The token travels to Siteverify with the visitor's IP
(`remoteip`); the IP is also the rate-limit key. Neither is stored or
logged — Workers Logs keep `{event, outcome, ms}` only, invocation logs off.
The secret is a runtime secret (`TURNSTILE_SECRET`), never in the repo.
The Privacy Policy's `#turnstile` section says all of this to visitors, and
the gate's step 2 links to it.

**Testing.** Unit tests cover every refusal, verdict and the retry
(`worker/*.test.ts`) and the client's fail-open paths
(`src/lib/turnstile.test.ts`). The e2e suite stands in for Cloudflare:
`api.js` is served from its real URL (so the page CSP is exercised) and
`/api/verify` — which `astro preview` does not run — answers 200, 503 or is
blocked (docs/11 §5). The Worker itself — routing, both limiters, `_headers` on
what it passes through — runs under `wrangler dev` in the e2e project
`worker` (docs/11 §5). What only production can show: the real edge, the
secret — verified after each deploy (docs/13 §3).

## 5. Vulnerability reporting

`public/.well-known/security.txt`:

```
Contact: mailto:security@poli0981.dev
Contact: https://github.com/poli0981/softharbor/security/advisories/new
Preferred-Languages: en, vi
Expires: 2027-07-28T00:00:00.000Z
Canonical: https://softharbor.net/.well-known/security.txt
Policy: https://github.com/poli0981/softharbor/blob/main/SECURITY.md
```

Served as `text/plain; charset=utf-8` (a `_headers` rule — RFC 9116 §3).
Since 2026-10-21 the address is `security@poli0981.dev` (D27,
`src/lib/contacts.ts`); `contact@softharbor.net` is retired everywhere.
Mail for `poli0981.dev` is delivered to a Google-hosted mailbox (MX
`aspmx.l.google.com`, docs/16 §6). `Expires` rolls forward yearly
(docs/13 §6).

Root `SECURITY.md`: supported target = latest deploy only; report via
GitHub *Private vulnerability reporting* (action item H4) or
`security@poli0981.dev`; acknowledgment ≤ 72 h; scope = the site, its
build, its workflows, **the `/api/verify` endpoint** (`worker/`) and the
dataset (wrong/dangerous link reports are explicitly welcome and handled via
the quarantine flow); out of scope = vulnerabilities in *listed third-party
apps themselves* → report to their vendors, but tell us too so we can flag.

## 6. Data-vetting checklist (before `security.status: "clean"`)

Run all steps before an entry is first marked `clean`, and again whenever
its links change; link the scan in `evidence`. This checklist is the
*definition* of "clean". Since 2026-10-23 `checkedAt` is the date of the
**latest scan** (step 5): `vt-recheck.yml` re-runs that step at least every 90
days and moves the date, while steps 1–4 stay with the maintainer (D30).

1. **Domain authenticity** — homepage/download domain matches the vendor's
   known official domain (cross-check the project's repo, Wikipedia infobox,
   or package-manager metadata; apply the established sponsor-email
   domain-verification method). No look-alike TLD swaps.
2. **HTTPS + sane redirect chain** — final download page is https on the
   official domain (lychee output helps).
3. **Reputation sweep** — search `<name> malware|bundled|adware` for the
   past 2 years; check the project's issue tracker for security advisories.
4. **Installer hygiene** — release notes/installer page shows no bundled
   third-party offers; if the vendor publishes checksums/signatures, note
   that on the entry's `tags` (`signed-releases`) — optional.
5. **VirusTotal** — scan the download-page URL; for directly-linked
   binaries of less-known apps, scan the file. The permalink goes into
   `evidence` — **required**: since v1.1 the schema refuses `clean` (and
   `flagged`) without an `evidence` URL (docs/04 §2). **Assisted since
   2026-10-23** (docs/12 §4b): `scripts/vt-recheck.mjs` submits
   `links.download` through the VirusTotal API and writes the permalink and
   date; dispatched on a data branch it scans a PR's new entries before
   merge, and daily on `main` it re-scans every check older than 90 days. It
   never decides `clean` or `flagged`: zero detections keep the status, any
   detection drops `clean` to `unverified` and opens a `[vt] <slug>` issue,
   and a promotion to `clean` happens only for slugs the maintainer lists
   (`promote`).
6. **Judgment call** — anything uneasy ⇒ leave `unverified` (listable) or
   `flagged` (quarantine) — never "clean by default".

Flag procedure (any time after listing): set `status: "flagged"` and run
`pnpm quarantine` in the same PR — `validate:data` fails a flagged entry
left in `src/data/apps/`. If a flagged entry ever reaches `main` anyway, the
quarantine workflow (on data pushes and nightly) moves it in a signed PR and
opens the tracking issue (docs/12 §4). The workflow acts on files only — it
does not read issue labels.

## 7. Supply-chain hygiene

- `pnpm-lock.yaml` committed; CI uses `pnpm install --frozen-lockfile`.
- **Dependency build scripts: `allowBuilds` in `pnpm-workspace.yaml`, and
  deliberately NOT `ignore-scripts`.** Corrected in P1 (2026-07-27) — the
  original guidance was wrong twice over:
  1. pnpm ≥ 10 **already** blocks dependency install scripts by default and
     requires an explicit per-package allowlist. That is strictly better than
     `ignore-scripts`: reviewable, granular, committed.
  2. Setting `ignore-scripts=true` on top *also* suppresses the allowlist, so
     esbuild never links its native binary and `pnpm build` cannot run at all.
     pnpm 11 additionally hard-fails on any un-decided build script, so this
     is a build-stopper, not a warning.
  3. pnpm 11 moved the setting out of `package.json`'s `pnpm` field into
     `pnpm-workspace.yaml` and renamed it `allowBuilds` — leaving it in
     `package.json` is silently ignored with a warning.

  Current allowlist, each entry a decision: `esbuild: true` (native binary,
  the build cannot run without it), `lefthook: true` (installs our git
  hooks), `workerd: false` (Cloudflare's local Worker runtime, pulled in by
  wrangler). The `workerd` comment in `pnpm-workspace.yaml` still says we
  "never run a Worker locally"; since D25 there is a Worker, but it is
  tested under Vitest in Node with a stubbed Siteverify and validated by
  `wrangler deploy --dry-run` in CI, neither of which needs `workerd`.
  Whether `wrangler dev` (with `.dev.vars`) runs with the script blocked:
  ⚠ verify. Flipping any entry to `true` requires a decision-log line.
- **`overrides`** in `pnpm-workspace.yaml` force patched floors for
  `brace-expansion`, `fast-uri` and `serialize-javascript`, and for the
  `undici` 7 copy that `miniflare` pins exactly (`miniflare>undici`; added
  2026-10-26), each with the advisory ids in a comment. All of them reach
  us only through build or dev tooling (`@vite-pwa/astro` →
  `workbox-build`, `wrangler` → `miniflare`); nothing ships to a visitor.
  CI's OSV-Scanner step fails `gates` on any of them, so a new transitive
  advisory blocks every PR — Dependabot's included — until it is handled
  here. Remove a line once upstream's own range moves past it.
  `peerDependencyRules` accepts `@vite-pwa/astro`'s stale Astro peer range
  explicitly (it works on Astro 7; `check:sw` proves it every build).
- **pnpm 11's default 24 h `minimumReleaseAge`** refuses any release younger
  than a day; Dependabot's 2-day cooldown keeps its PRs installable under
  `--frozen-lockfile` (docs/12 §6).
- **Dependabot** (weekly, npm + github-actions, docs/12 §6) replaced
  Renovate on 2026-10-21 — Renovate was never installed and never ran.
  Dependabot security updates are enabled in the repository settings.
  `osv-scanner` + `pnpm audit --prod` gate every PR and push to `main`
  (`ci.yml` `gates` job — docs/01 §5, docs/12 §2). CodeQL runs on PRs,
  pushes and weekly; SonarQube Cloud's CI-based analysis (`ci.yml` `sonar`
  job, `sonar-project.properties`) covers workflows, scripts and the site
  code, with coverage, on every PR and push to `main`.
- All GitHub Actions in this repository's workflows pinned to **commit
  SHAs** with a version comment (Dependabot bumps both); the org's own
  reusable workflows (`poli0981/.github`) are tracked at `@main` on purpose.
  `notify.yml` passes the one secret it needs, not `secrets: inherit`.
- **Signed commits** are required on `main` by the ruleset; the quarantine
  bot signs through the API (docs/12 §4/§8).
- Dependency budget: adding any new runtime dependency requires a
  decision-log entry; prefer zero-dependency utilities.

## 8. Privacy (implementation-level; user-facing text in docs/14 §3b)

Client storage inventory — the complete list. Every localStorage key has
exactly one typed reader/writer in `src/lib/` (lint-enforced, docs/10 §3)
— `theme.js` mirrors three of them pre-paint — which is what keeps this
table true:

| Key / store | Content | Lifetime |
|---|---|---|
| `sh:legal` | accepted legal version string (`LEGAL_VERSION`) | until cleared |
| `sh:human` | expiry timestamp (ms) of the human check: +48 h after a pass, +1 h when the gate let the visitor through unchecked (§4a) | self-expiring; until cleared |
| `sh:lang` | `en` \| `vi` — the language suggestion was answered | until cleared |
| `sh:theme` | `light` \| `dark` (absent = system) | until cleared |
| `sh:scrollbar` | `thin` \| `hidden` (absent = default) | until cleared |
| `sh:motion` | `reduce` (absent = follow the OS) | until cleared |
| SW cache | offline page, its CSS, the three head scripts, the latin + Vietnamese body/display fonts, favicon | managed by Workbox |
| Ring buffer | `window.__shErrors`, in memory only (docs/05 §A5) | page lifetime |
| Session fallbacks | `globalThis` flags holding the gate's acceptance / check result when storage throws | page lifetime |

**SoftHarbor sets no cookies** and does no fingerprinting. Who else sees
what — the list the Privacy Policy mirrors (`/legal/privacy`):

| Party | When | What |
|---|---|---|
| Cloudflare (hosting) | every request | connection data such as IP addresses, as infrastructure provider under its own policy; we see aggregate counts only |
| Our Worker's rate limit (D32) | every page, feed and data request | the IP address (IPv6: its /64) as the key of a counter Cloudflare's rate limiter keeps for 10 s; never logged — a refusal logs only its kind (docs/08 Part F) |
| Cloudflare Web Analytics (D26) | page loads on `softharbor.net` only, **never** when `navigator.globalPrivacyControl === true` | page URL, referrer, load timings, user-agent; cookieless; we see totals |
| Cloudflare Turnstile (D25) | once, after the documents are accepted | browser/device signals inside its iframe; the token plus IP go to Siteverify via our Worker (§4a) |
| GitHub | only if the visitor opens "Report a bug" | the prefilled URL carries page URL, user-agent and recent error lines — GitHub receives them **when the link is opened**; nothing is filed until the visitor submits (docs/05 §A6) |
| Google | only if someone emails us | `@poli0981.dev` mail is delivered to a Google-hosted mailbox |

Adding a party, a key or a store is a change to this table, to the
Privacy Policy and — for a third-party runtime request — a decision-log
entry (hard rule 7).
