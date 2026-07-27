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
  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-<THEME_HASH>'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

/api/apps.json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300

/search-index.json
  Cache-Control: public, max-age=300

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
```

Notes:

- **Inline scripts.** Exactly two inline snippets exist: the theme no-flash
  script (docs/05 §A8) and Astro's View-Transitions runtime glue. Enable
  Astro's CSP support so hashes are generated at build; the `script-src`
  hash list in `_headers` must be produced by a small build step
  (`scripts/emit-csp.mjs` reads Astro's hash output and rewrites the
  placeholder) — never hand-maintained. If Astro's CSP feature proves
  awkward in spike S1, fallback: externalize both snippets to tiny `.js`
  files and drop the hash entirely (`script-src 'self'`), accepting a
  one-frame theme flash risk mitigated by a blocking `<script src>` in
  `<head>`.
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
- `.npmrc`: `ignore-scripts=true` (no postinstall execution; the chosen
  stack needs none — verify in spike S1, whitelist individually via
  `pnpm.onlyBuiltDependencies` if something truly requires it).
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
