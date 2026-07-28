# 09 — Security & Privacy

## 1. Posture in one paragraph

A static site with no accounts, no forms, no cookies, no third-party
requests, and no server code has a small attack surface — the residual risks
are **supply chain** (our build), **data integrity** (a malicious or sloppy
listing), and **reputation** (recommending software that later turns out
harmful). Sections below address exactly those three, plus the honest-privacy
story.

## 2. Threat model

| # | Asset | Threat | Mitigation |
|---|---|---|---|
| T1 | Visitors' machines | A listed app is/becomes malware; user installs it trusting us | Inclusion criteria C5–C7; vetting checklist §6; dated `security.status` (never a guarantee — hard rule 4); quarantine pipeline (docs/03 §5); monthly re-verification (docs/13 §6); Disclaimer (docs/14 §3a) |
| T2 | Visitors | Typosquat/mirror `links.download` sneaks into a PR | Official-domain rule (hard rule 8); L4 human review compares domain to vendor's known domain; lychee catches parked/dead domains; PRs from non-maintainers never auto-merge |
| T3 | Site integrity | Supply-chain compromise of a dependency poisons the build | §7: lockfile, `ignore-scripts`, Renovate + osv-scanner, SHA-pinned actions, minimal dependency count |
| T4 | Site integrity | XSS via data fields | All rendering through Astro's default escaping; **no `set:html` anywhere** (lint-banned); schema constrains URLs to https; CSP §4 as backstop |
| T5 | Visitors | Clickjacking / framing on a look-alike site | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| T6 | Repo | Malicious PR alters workflows/scripts | Branch protection; CODEOWNERS on `.github/**`, `scripts/**`, `src/data/**`; workflows from forks get read-only token (GitHub default) |
| T7 | Availability | DDoS | Cloudflare edge absorbs; static assets, nothing to exhaust; no further action in v1 |
| T8 | Users' privacy | Tracking/leakage | No analytics, no third-party origins (CSP-enforced), localStorage-only prefs §8 |
| T9 | The domain itself | `softharbor.net` hijack (registrar/DNS) or email spoofing "from" the domain | Registrar transfer lock + auto-renew, DNSSEC enabled, zone changes only via the two admin paths (dashboard, wrangler deploy); SPF + DMARC (`p=quarantine` → `reject`) — all in docs/16 §2/§6 |

## 3. Non-existent surfaces (by design)

No auth, no sessions, no cookies, no server input parsing, no file uploads,
no comments. Keep it that way: any feature that adds one of these requires a
threat-model update in this file first.

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
  Cache-Control: public, max-age=0, must-revalidate

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/api/apps.json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300

/search-index.json
  Cache-Control: public, max-age=300
```

**There is no `/fonts/*` rule.** Astro content-hashes the self-hosted fonts
into `/_astro/` along with JS and CSS, so the `/fonts/*` rule earlier drafts
carried matched nothing (verified in M1: `dist/` contains 13 `.woff2` files,
all under `_astro/`). The `/_astro/*` rule above already gives them the right
`immutable` treatment — and correctly so, since they *are* content-hashed.

Notes:

- **The CSP is split between a header and a meta tag (decision D20,
  supersedes D18).** Settled empirically in spike S1, 2026-07-27:
  - `<ClientRouter />` compiles to an **external** module script — it was
    never the problem.
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
- **`_headers` must therefore carry only `frame-ancestors`.** A header CSP
  and a meta CSP are enforced as **two separate policies**, and a resource
  must satisfy both — so a `script-src 'self'` in `_headers` would intersect
  with the meta policy, drop Astro's hashes, and break every island.
  `frame-ancestors` is the one directive that must stay in the header,
  because meta-tag CSP ignores it by spec. `X-Frame-Options: DENY` backs it up.
- **Verification** (re-run whenever islands or the config change): build,
  then for every page in `dist/**/*.html` recompute the SHA-256 of each
  inline `<script>`/`<style>` body and assert it appears in that page's meta
  policy. P1 ran this and every inline resource matched. This check is worth
  keeping as a build-time assertion — it fails loudly if Astro ever emits a
  snippet it does not hash.
- **Residual weakness, accepted:** Astro puts the union of known hashes in
  every page's policy (9 hashes on a page that uses 3). Still hash-pinned,
  never `'unsafe-inline'` — just less tight per page than it could be.
- **JSON-LD** (`<script type="application/ld+json">`) is a data block, not an
  executable script, so it needs no hash under `script-src` (docs/16 §7).
- **Cache-Control precedence.** Cloudflare `_headers` applies *every* matching
  rule, so the `/*` block's `must-revalidate` and the `/_astro/*` `immutable`
  rule both match hashed assets. Verify with
  `curl -sI https://softharbor.net/_astro/<file>` that the immutable value
  wins; if it does not, scope the HTML rule to `/*.html` instead of `/*`.
- `Strict-Transport-Security` is deliberately **absent from `_headers`**:
  it is configured once at the zone level with a phased max-age rollout
  (docs/16 §5) so it also rides on redirect responses. Keeping it out of
  `_headers` avoids two sources of truth with conflicting `max-age`.
- `Access-Control-Allow-Origin: *` only on the intentionally-public dataset.
- Verify after every deploy touching `_headers`:
  `curl -sI https://…/ | grep -iE 'content-security|frame|referrer'` +
  an observatory scan pre-launch (docs/13 §2).

## 5. Vulnerability reporting

`public/.well-known/security.txt`:

```
Contact: mailto:contact@softharbor.net
Contact: https://github.com/poli0981/softharbor/security/advisories/new
Preferred-Languages: en, vi
Expires: 2027-07-20T00:00:00.000Z
Canonical: https://softharbor.net/.well-known/security.txt
```

(The mailbox goes live via Email Routing before launch — docs/16 §6 / H5.)

Root `SECURITY.md` (created in P6): supported target = latest deploy only;
report via GitHub *Private vulnerability reporting* (action item H4) or the
H5 email; acknowledgment ≤ 72 h; scope = the site, its workflows, and the
dataset (wrong/dangerous link reports are explicitly welcome and handled via
the quarantine flow); out of scope = vulnerabilities in *listed third-party
apps themselves* → report to their vendors, but tell us too so we can flag.

## 6. Data-vetting checklist (before `security.status: "clean"`)

Run all steps; record date in `checkedAt`; link scan in `evidence` when
available. This checklist is the *definition* of "clean".

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
5. **VirusTotal (when feasible)** — scan the download-page URL; for
   directly-linked binaries of less-known apps, scan the file. Paste the
   permalink into `evidence`.
6. **Judgment call** — anything uneasy ⇒ leave `unverified` (listable) or
   `flagged` (quarantine) — never "clean by default".

Flag procedure (any time after listing): set `status: "flagged"` via PR or
let the quarantine workflow act on a maintainer-labeled issue; the workflow
moves the file and opens the tracking issue (docs/12 §4).

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
  wrangler — we ship pure static assets and never run a Worker locally).
  Flipping any entry to `true` requires a decision-log line.
- Renovate weekly + `osv-scanner` + `pnpm audit --prod` gate (docs/01 §5,
  docs/12 §6).
- All GitHub Actions pinned to **commit SHAs** with a version comment.
- Dependency budget: adding any new runtime dependency requires a
  decision-log entry; prefer zero-dependency utilities.

## 8. Privacy (implementation-level; user-facing text in docs/14 §3b)

Client storage inventory — the complete list:

| Key / store | Content | Lifetime |
|---|---|---|
| `sh:legal` | accepted legal version string | until cleared |
| `sh:lang` | `en` \| `vi` preference | until cleared |
| `sh:theme` | `light` \| `dark` (absent = system) | until cleared |
| SW cache | offline shell (offline page, fonts, favicon) | managed by Workbox |
| Ring buffer | in-memory only (docs/05 §A5) | page lifetime |

No cookies, no fingerprinting, no analytics (D14), no third-party requests
(CSP-enforced). Network operator: Cloudflare serves requests and therefore
processes IPs/logs as infrastructure provider under its own policies —
disclosed in the Privacy Policy. Bug reports happen on GitHub under GitHub's
terms; the prefilled URL shows the user *exactly* what would be submitted
before they post it (docs/05 §A6) — nothing is sent automatically.
