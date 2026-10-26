# 16 — Custom Domain & SEO Operations (`softharbor.net`)

> Added in suite v1.1 (2026-07-20) after the domain purchase. This doc owns
> everything zone-level: DNS, redirects, TLS/HSTS, email, robots/sitemap,
> structured data, Search Console, and the features we deliberately keep
> off. Platform facts below (plan gating, config keys) were re-verified
> against Cloudflare docs on 2026-07-20. **DNS records and response headers
> were re-observed on 2026-10-21** (`nslookup`, `curl -I`) for suite v2.0 —
> anything that could only be seen in the dashboard is marked ⚠ verify.
>
> Timing note: the domain arrived **before launch** — nothing is indexed on
> `workers.dev`, so there is no migration, no legacy 301s, no Search Console
> history to move. The site launches directly on `softharbor.net`.

## 1. Locked decisions (mirrored in docs/15 §4)

| # | Decision | Choice |
|---|---|---|
| N1 | Canonical origin | **`https://softharbor.net`** — apex, no `www` |
| N2 | `www.softharbor.net` | 301 → apex, path + query preserved (zone Redirect Rule) |
| N3 | `workers.dev` main route | **Disabled** (`workers_dev: false`); PR previews stay on versioned preview URLs (`preview_urls: true` — must be explicit, since it defaults to follow `workers_dev`) |
| N4 | Zone plan | **Free** (Workers Paid is account-level and unrelated). Consequence: Cloudflare **Custom Errors stays unavailable** (paid-zone feature) → `/errors/403` and `/errors/500` remain dormant; `/errors/429` is served by the Worker since D32, not by the zone |
| N5 | HSTS | Zone-level, phased rollout (§5) — **not** in `_headers` |
| N6 | Rate limiting & Bot Fight Mode | Bot Fight Mode **OFF** (§9). Rate limiting: the Worker's site-wide limit since D32 (docs/08 Part F), plus the zone rule as an optional edge layer — recipe §9.1 |
| N7 | Contact email | ~~`contact@softharbor.net` via Cloudflare Email Routing (§6) — resolves H5~~ — ⛔ **superseded 2026-10-21 by D27**: one address per purpose at `@poli0981.dev`, mail hosted by Google (§6) |
| N8 | Search plumbing | GSC **Domain property** + sitemap; Bing via GSC import; Crawler Hints (IndexNow) ON |

## 2. Zone, registrar & DNS

### 2.1 Zone onboarding

1. Cloudflare dashboard → Add site → `softharbor.net` → **Free** plan.
2. If the domain was bought at **Cloudflare Registrar**: nameservers, WHOIS
   redaction, and transfer lock are handled automatically — skip to 2.2.
   If bought elsewhere: set the two assigned Cloudflare nameservers at the
   registrar, enable the registrar's **transfer lock**, and turn on
   auto-renew (an expired domain is the project's single worst failure
   mode).
3. **DNSSEC:** DNS → Settings → Enable DNSSEC. Cloudflare Registrar sets
   the DS record itself; external registrars need the shown DS record
   pasted in their panel. Verify later with `dig +dnssec softharbor.net`.

### 2.2 DNS records (complete v1 set)

| Type | Name | Content | Proxy | Purpose |
|---|---|---|---|---|
| *(auto)* | `softharbor.net` | Worker custom domain | ☁️ | created when the custom domain was attached to the Worker (§3) — do not hand-edit |
| *(auto)* | `www` | Worker custom domain | ☁️ | **Attached as a Worker Custom Domain in the dashboard** (Workers & Pages → softharbor → Domains), like the apex. History: a hand-made `AAAA www → 100::` placeholder was removed by the next `wrangler deploy`, which reconciles the Worker's triggers — the redirect then died silently (observed 2026-07-28). The fix that day was to declare both domains in `wrangler.jsonc` `routes`; later the same day (commit 66c6255) the routes were removed again and the domains attached in the dashboard instead — with **no** `routes` key, a deploy leaves the triggers untouched. A fresh clone therefore needs both re-attached by hand. **Prerequisite: rule R1 (§4) must exist, or www would serve a duplicate of the site instead of redirecting.** |
| MX ×3 + TXT (SPF) | `@` | Cloudflare Email Routing: `route1/2/3.mx.cloudflare.net`; `v=spf1 include:_spf.mx.cloudflare.net ~all` | — | Still published (observed 2026-10-21) although no published address uses softharbor.net since D27 — keep or retire, §6 |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=…` (Cloudflare DMARC Management + the maintainer's inbox) | — | anti-spoofing — `p=quarantine` observed 2026-10-21 (§6) |
| TXT | `@` | `google-site-verification=…` | — | GSC Domain property (§8) — present (observed 2026-10-21) |

No other records. CAA is optional hardening — if added, it must include
every CA Cloudflare Universal SSL may use (check their current CA list at
that time); safest v1 choice is to add none.

### 2.3 TLS settings (SSL/TLS tab)

Universal SSL: automatic (nothing to do). Edge Certificates: **Minimum TLS
1.2**, TLS 1.3 **On**, **Always Use HTTPS On**. Encryption mode: Full
(Strict) as zone default hygiene — moot for the Worker route (TLS
terminates at the edge; there is no origin), relevant only if other records
ever appear.

## 3. Attaching the Worker (dashboard custom domains)

*Originally IaC-first: the domains were declared as `routes` with
`custom_domain: true` so a fresh clone would reproduce production. Reversed
on 2026-07-28 (commit 66c6255) after a deploy's trigger reconciliation cost
the `www` record (§2.2).* Today `wrangler.jsonc` (full reference: docs/02
§7) declares **no `routes`**:

```jsonc
{
  "name": "softharbor",
  "main": "./worker/index.ts",            // D25 + D32 — rate limit, /api/verify
  "compatibility_date": "2026-10-01",
  "assets": { "directory": "./dist", "binding": "ASSETS",
              "not_found_handling": "404-page",
              "html_handling": "drop-trailing-slash",
              "run_worker_first": ["/*", "!/_astro/*", …] }, // D32, docs/02 §7
  // No "routes": softharbor.net and www.softharbor.net are Custom Domains
  // attached in the dashboard; with no routes key a deploy leaves them be.
  "workers_dev": false,     // kills softharbor.<account>.workers.dev
  "preview_urls": true      // explicit — defaults to workers_dev's value
}
```

Both hostnames are attached under the Worker's *Domains & Routes*
(Workers & Pages → softharbor → Domains); attaching a custom domain
creates its DNS record and certificate. The price of the reversal: a Worker
re-created from a fresh clone does **not** get its domains back from the
config — re-attach `softharbor.net` and `www.softharbor.net` by hand
(R1 must exist first), then set the runtime secret (docs/08 Part E).

Preview URLs: PR previews keep working at
`<version-prefix>-softharbor.<account>.workers.dev`. They are unlinked,
short-lived, carry no sitemap, and since v1.1 send **`X-Robots-Tag:
noindex`**: `_headers` supports absolute-URL patterns with placeholders,
and the rule `https://:version.:subdomain.workers.dev/*` matches preview
hosts and never the production domain (docs/09 §4). Their canonicals point
at softharbor.net anyway. Never link a preview URL anywhere public except
the PR comment.

## 4. Redirects

| Layer | Owner | Used for |
|---|---|---|
| Zone **Redirect Rules** (run before the Worker, all plans) | R1 below | host-level: `www` → apex |
| **Always Use HTTPS** | zone setting | `http://` → `https://` |
| `public/_redirects` (static assets) | app | path-level only: future slug renames (docs/04 §2) — cannot match hosts. Not present yet: no slug has ever been renamed |

**R1 — www to apex** (Rules → Redirect Rules → template *"Redirect from
WWW to Root"* or manual):

- If: hostname equals `www.softharbor.net`
- Then: Dynamic redirect, status **301**, expression
  `concat("https://softharbor.net", http.request.uri.path)`,
  **Preserve query string ✓**

That is the only zone redirect in v1.

## 5. HSTS (phased, zone-level)

Configured at SSL/TLS → Edge Certificates → HTTP Strict Transport Security
— zone-level so the header also rides on redirect responses; `_headers`
deliberately carries no HSTS (single source of truth, docs/09 §4).

| Phase | When | Setting |
|---|---|---|
| P1 | launch day | `max-age=86400` (1 day), includeSubDomains ✓ (only subdomain is `www`, already proxied+redirected) |
| P2 | +2 weeks, no TLS issues | `max-age=31536000` (1 year) |
| P3 | +1 month, optional | add `preload` ✓ and submit at hstspreload.org — **semi-irreversible** (removal from browser preload lists takes months); Kokone's explicit call (docs/15 §5) |

**Observed 2026-10-21:** `Strict-Transport-Security: max-age=31536000;
includeSubDomains; preload` on the apex — the zone is at **P3** already,
skipping the staged burn-in (docs/15 §5 item 8). Whether the domain was
also *submitted* to hstspreload.org: ⚠ verify.

## 6. Email on the domain (+ anti-spoofing)

**Current state (2026-10-21, D27).** The site no longer publishes any
address on this domain. Every contact is **one address per purpose at
`@poli0981.dev`** — `security@`, `privacy@`, `legal@`, `dmca@`,
`takedown@`, `copyright@`, `code@`, `press@`, `collab@` (table: docs/14
Part 2; source: `src/lib/contacts.ts`) — and `security.txt` names
`security@poli0981.dev`. Mail for `poli0981.dev` is **hosted by Google**:
its MX records point at `aspmx.l.google.com` (+ `alt1`–`alt4`), observed
2026-10-21. That is a different domain, whose DNS is managed outside this
repository and outside this zone (its own DMARC read `p=none` on
2026-10-21 — out of scope here). The Privacy Policy says mail is
Google-hosted (`#email`). **This changes the original Email Routing plan
below**: `contact@softharbor.net` is retired everywhere.

**What softharbor.net still publishes** (observed 2026-10-21): the Email
Routing records — MX `route1/2/3.mx.cloudflare.net` and SPF
`v=spf1 include:_spf.mx.cloudflare.net ~all` — and `_dmarc` at
`p=quarantine`, reporting to Cloudflare's DMARC Management and the
maintainer's inbox. Whether the old `contact@` route still forwards
anywhere: ⚠ verify in the dashboard. Two coherent options, a decision
rather than a cleanup (H5): **keep** the records (harmless, receive-only;
DMARC still protects the name), or **retire** Email Routing and publish the
non-sending-domain set — `v=spf1 -all` and DMARC `p=reject` — with no MX.
Either way the domain sends nothing.

*Original plan (2026-07-20) — superseded by D27, kept for the record:*

**Receiving** — Cloudflare **Email Routing** (free): Email → Email Routing
→ enable → verify the personal destination inbox → create address
`contact@softharbor.net` → forward. The wizard writes the MX records and an
SPF TXT (`v=spf1 include:_spf.mx.cloudflare.net ~all`). This resolved
action item **H5** at the time.

**Anti-spoofing** — add `_dmarc` TXT with `p=quarantine` and an `rua`
reporting address → after ~1 month of clean reports, tighten to
`p=reject`. (Live record: `p=quarantine`, above — the `p=reject` step has
not been taken.)

**Sending** — the domain sends nothing (Email Routing is receive-only;
replies go out from the personal mailbox). If a send-as setup is ever added
for softharbor.net, revisit SPF/DKIM/DMARC in the same PR — the current
policy would junk such mail by design.

## 7. On-page SEO

- **`site`**: `https://softharbor.net` in `astro.config.ts` — canonicals,
  hreflang (docs/07 §6), sitemap, RSS links, and OG URLs all derive from
  it. Grep the repo for `workers.dev`: only deliberate mentions should
  remain — §3's preview note, the `_headers` preview `noindex` rule, the
  `wrangler.jsonc` comments, `CLAUDE.md` (docs/13 §2).
- **`public/robots.txt`** (final):

  ```
  User-agent: *
  Allow: /

  Sitemap: https://softharbor.net/sitemap-index.xml
  ```

- **noindex surface:** `/offline`, `/errors/*` **and `/404`** get
  `<meta name="robots" content="noindex">` (reachable but meaningless in
  SERPs). The 404 used to rely on its status code, but `/404` requested
  directly is served with 200, so since v1.1 it carries the tag too. These
  single bilingual pages emit no hreflang alternates. Legal and contact
  pages stay indexable.
  **They must also be excluded from the sitemap**, via the `sitemap({ filter })`
  option in `astro.config.ts` (docs/02 §4). `noindex` alone is not enough:
  submitting a noindex'd URL makes GSC report *"Submitted URL marked
  noindex"* on every crawl, which buries the hreflang errors we actually
  want to see (§8 monitoring cadence).
- **Structured data (JSON-LD):**
  - `/apps/[slug]` (`ShJsonLd.astro`): `SoftwareApplication` — `name`,
    `description` (locale summary), `operatingSystem` (joined platforms),
    `applicationCategory` (primary category label EN), `url` (the
    SoftHarbor page in that locale), `author` (an `Organization` named by
    the `developer` field), `sameAs: [homepage, repo]`, and `offers {
    "@type": "Offer", "price": "0", "priceCurrency": "USD" }` **only when
    `pricing === "free"`** — we never state amounts for `onetime`
    (truthfulness > rich-result greed). Plus `BreadcrumbList`
    (Home → Apps → app).
  - Site-wide: one `WebSite` node on `/` and `/vi` (`inLanguage` per
    locale). No `SearchAction` yet — but since v1.1 `/apps?q=<terms>` **is**
    a working deep link (`src/lib/urlstate.ts`, docs/05 §A3), so the node is
    now possible; it is a backlog item (docs/15 §2), not a blocker.
  - JSON-LD `<script type="application/ld+json">` blocks are data blocks,
    not executable scripts, so the strict CSP (docs/09 §4) does not need
    hashes for them (confirmed in the S1 build; `check:csp` skips them
    explicitly). `<` is escaped as `<`, so a `</script>` inside a name
    or summary cannot end the block early.
- **OG/meta:** `og:site_name`, `og:title`, `og:description` (locale
  summary), `og:url` (canonical), `og:locale` + `og:locale:alternate`,
  `twitter:card=summary`. Per-app OG images stay post-v1 (docs/15 §2).
- **Every indexable page needs its OWN description.** App pages get the
  locale summary for free, but `/apps`, `/categories`, the 24 category pages
  and the legal pages all fell through to `site.tagline` — 47 pages sharing
  one string, which Google treats as a quality signal and usually rewrites.
  They now build from `meta.apps`, `meta.categories`, `meta.category` and
  `meta.legal` — and since v1.1 `meta.contact` — so 694 of 699 pages were
  unique when measured (2026-07-30; 701 pages at v1.1); the remainder are
  the home page (where the tagline *is* the description) and the noindex
  error pages. Legal pages also carry the `— SoftHarbor` title suffix: an
  unbranded `<title>` in a SERP reads as somebody else's document.

## 8. Search-engine plumbing

**Google Search Console — Domain property** (covers apex + www + both
schemes):

1. GSC → Add property → **Domain** → `softharbor.net`.
2. Copy the `google-site-verification=…` TXT → Cloudflare DNS (name `@`)
   → Verify (propagation is usually minutes). *The TXT record is published
   (observed 2026-10-21); whether the property, the sitemap submission,
   the Bing import and Crawler Hints are done: ⚠ verify (docs/15 §5).*
3. Post-launch: submit `https://softharbor.net/sitemap-index.xml`; URL
   Inspection on `/` and one app page; confirm hreflang pairs report clean
   after the first crawl.

**Bing Webmaster Tools:** sign in → *Import from Google Search Console* —
one click, covers Bing/Copilot and (partially) DuckDuckGo.

**IndexNow via Crawler Hints:** zone → Caching → Configuration → enable
**Crawler Hints**. Free, one toggle; Cloudflare pings IndexNow engines
(Bing, Yandex, …) when cache signals suggest content changed. Google
ignores IndexNow — GSC + sitemap covers it. No app-side IndexNow key
needed while this is on.

**Monitoring cadence:** monthly GSC review (Coverage, Core Web Vitals,
hreflang errors) — added to docs/13 §6.

## 9. Deliberately OFF (with activation recipes)

| Feature | Status & reason | Recipe if ever needed |
|---|---|---|
| **Rate limiting** (zone) | **Optional edge layer since D32 — owner step, ⚠ verify once deployed.** The site's rate limit lives in the Worker (docs/08 Part F: 60 page requests per 10 s, our own 429 page). The zone rule can sit in front of it as layer 1: it blocks a flood before the Worker runs (so before it is billed), but on the Free zone only with **Cloudflare's default 429 page** (custom responses need Pro), which is why it must stay looser than the Worker's limit. | §9.1 — one rule, URI Path starts with `/` and not a verified bot, **150 per 10 s per IP**, Block 10 s. (The pre-D32 recipe here named `http.host` and a 1-minute block, neither of which the Free plan offers.) |
| **Bot Fight Mode** | OFF. It challenges automated clients — which would break exactly what we publish for automation: `/api/apps.json` consumers and the `notify.py` RSS cron. The legal gate's Turnstile check (D25) is no substitute and no conflict: it runs in visitors' browsers, after consent, and fails open. | Only with a scoped WAF exception for `/api/*` and `/rss.xml` — and only in response to actual abuse. |
| **Speed Brain** (speculative prefetch) | **Should be OFF.** Cloudflare refuses speculative requests on Worker requests — a `Sec-Purpose: prefetch` GET gets a bare **503** with `Cf-Speculation-Refused: prefetch refused: disabled for worker requests` — which is why `astro.config.ts` sets `prefetch: false` (docs/02 §4). **Observed 2026-10-21: production still sends `Speculation-Rules: "/cdn-cgi/speculation"`**, i.e. the zone feature appears to be on (H12, ⚠ verify and turn off). | Turn the zone's Speed Brain toggle off (Speed settings in the dashboard). Revisit only if Cloudflare ever allows speculation on Worker routes. |
| **Cloudflare Custom Errors** | Unavailable on Free zone (paid-plans feature; also never applies to 500/501/503/505). `/errors/{403,429,500}` templates stay **dormant** as designed. | Upgrade zone to Pro → Rules → Custom Error Rules → point 403/429 at the templates. Decision logged if taken. |
| **Cache tuning / Page Rules / Snippets** | Defaults. Workers Static Assets already serves from the edge; `_headers` (docs/09 §4) owns per-path `Cache-Control` — `/*` sets none and each specific rule detaches with `! Cache-Control`, because Cloudflare comma-joins a header set by several matching rules. | — |

### 9.1 Layer 1 at the edge — the zone rate-limiting rule (owner step)

Since D32 there are two layers. **Layer 1**, this zone rule, throws a
flood out at the edge before the Worker runs — not billed, but answered
with Cloudflare's default 429 page. **Layer 2**, the Worker's limit
(docs/08 Part F), answers moderate over-use with our own page. Layer 1 must
be the looser of the two, or nobody would ever see our page.

Free-zone constraints (Cloudflare's docs, read 2026-10-26): **one** rule;
counted **per IP** only; the expression may use only **URI Path** and
**Verified Bot** (no Host); period **10 s**; block duration **10 s**; the
Block response is Cloudflare's default 429 (a custom response needs Pro).
Use Block, not a challenge: a challenge would break `/api/apps.json` and
RSS consumers, which cannot solve one.

Dashboard → the `softharbor.net` zone → **Security** → **Security rules** →
**Create rule** → **Rate limiting rules** (older dashboards: Security → WAF
→ Rate limiting rules):

1. **Rule name:** `Edge flood guard (layer 1, D32)`.
2. **If incoming requests match:** Field **URI Path**, Operator **starts
   with**, Value `/` (every request) — **And** Field **Verified Bot**,
   Value **Off**, so search engines' verified crawlers are left to the
   Worker's limit and their own crawl-rate control. The expression preview
   should read `(starts_with(http.request.uri.path, "/") and not
   cf.client.bot)`.
3. **Cache status:** if **Also apply rate limiting to cached assets** is
   offered, leave it **on** — every request counts.
4. **With the same characteristics:** **IP** (the only choice on Free).
5. **When rate exceeds:** **150** requests per **10 seconds**.
6. **Then take action:** **Block**; **Duration:** **10 seconds**.
7. **Deploy.**

**Why 150.** The rule counts everything — each page's CSS, JS and fonts
(about fifteen requests for a first page load, cached afterwards) and the
Worker's own 429s — while the Worker allows 60 page requests per 10 s. 150
is out of reach for any person, above the Worker's limit so over-use meets
our page first, and far below a flood. Never set it under ~100.

**Verify** once it is deployed, from one machine — hammer a file the
Worker never sees (an asset-first path), so only layer 1 can answer:

```bash
seq 1 200 | xargs -P 20 -I{} curl -s -o /dev/null -w "%{http_code}\n" https://softharbor.net/favicon.svg | sort | uniq -c
```

Expect roughly 150 × `200` and the rest `429` (Cloudflare's page, not
ours); ten seconds later the file answers `200` again. **Roll back** by
turning the rule off on the same page — nothing in the repository depends
on it.

## 10. Rollout sequence & verification

> **Status 2026-10-21.** The rollout below is complete and historical: www
> redirects (R1), HSTS is at P3, DMARC is `p=quarantine`, the noindex header
> is long gone and the GSC verification record is published (§2.2, §5, §6).
> What recurs is the **verification after every merge** — and before it,
> waiting for the merge commit's "Workers Builds" check to go green: builds
> are serialized and a `main` merge can sit in the queue ~20 minutes, so an
> unchanged site right after a merge usually means "not deployed yet", not
> "broken" (docs/13 §3). The edge-propagation note below applies on top.
>
> **Status 2026-07-27 — apex is LIVE.** `wrangler deploy` created the apex DNS
> record and provisioned the certificate; `https://softharbor.net` serves the
> M1 skeleton. Verified: http → https 301, apex 200, `/nope` → branded 404,
> `_headers` applied, canonical URLs 200 with only the slashed variants
> redirecting, service worker registering and controlling, workers.dev main
> route dead (404).
>
> **Still to do, all dashboard steps (§4, §5, §6, §8):** `www` placeholder
> record + Redirect Rule R1, HSTS phase P1, Email Routing + DMARC, GSC Domain
> property + Crawler Hints. None are blocking, and all are steps 4–7 of the
> sequence below.
>
> A temporary `X-Robots-Tag: noindex` is set in `_headers` while the dataset is
> empty — **remove before v1.0.0** (docs/13 §2). Do not enable the §8 search
> plumbing until it is gone, or the two will fight.
>
> **Wait out edge propagation before trusting any post-deploy check.**
> Observed twice: after the first custom-domain deploy the edge briefly served
> the *pre-deploy* trailing-slash behaviour, and after the M2 deploy the newly
> added `/apps/<slug>` routes returned **404 intermittently** — the same URL
> alternating 200 and 404 between requests, because PoPs still serving the
> previous version genuinely did not have those routes. Both settled within a
> minute or two.
>
> So: a 404 on a brand-new route immediately after deploy is the expected
> transient, not a bug. Re-run the checks a few times and only investigate if
> results are **stable** and wrong. Verifying once, immediately, is how you
> end up debugging a correct configuration.

Order (fits between M5 and M6 of docs/15 — roughly one focused day):

1. Zone added → NS live (external registrar) → DNSSEC on.
2. Email Routing + DMARC → `contact@softharbor.net` receiving → update
   docs/14 + `security.txt` (H5 ✅ at the time; superseded 2026-10-21 by
   D27 — §6).
3. `wrangler.jsonc` routes/workers_dev/preview_urls change → deploy →
   apex live. (The routes later moved to dashboard custom domains — §3.)
4. `www` placeholder record + Redirect Rule R1 → Always Use HTTPS on.
5. HSTS phase P1 on.
6. `site` config + robots.txt + JSON-LD + noindex metas land in the repo.
7. GSC Domain property verified; Crawler Hints on. (Sitemap submit +
   Bing import happen at launch, docs/13 §2–3.)

Verification (run after step 6; add to launch checklist):

```bash
dig +short softharbor.net                    # resolves via CF
dig +dnssec softharbor.net | grep -i rrsig   # DNSSEC signing
curl -sI https://softharbor.net/ | grep -iE 'HTTP|strict-transport|content-security'
curl -sI http://softharbor.net/              # 301 → https
curl -sI https://www.softharbor.net/apps?x=1 # 301 → apex, path+query kept
curl -sI https://softharbor.net/apps/nope    # 404, branded page
curl -sI https://softharbor.<account>.workers.dev/   # dead (workers_dev off)
dig TXT _dmarc.softharbor.net +short         # DMARC policy present

# Trailing-slash canonicalisation (docs/02 §4/§7 — trailingSlash 'never'
# vs assets.html_handling). Exactly ONE of these returns 200 and the other
# must 301/308 to it. Two 200s = duplicate content; a loop = misconfigured.
curl -sI https://softharbor.net/apps/7-zip
curl -sI https://softharbor.net/apps/7-zip/

# Header CSP is ONLY frame-ancestors (D20, docs/09 §4) — script-src/style-src
# live in the per-page meta tag, which must list the two Cloudflare origins.
curl -sI https://softharbor.net/ | grep -i content-security-policy
curl -s  https://softharbor.net/ | grep -o '<meta http-equiv="content-security-policy"[^>]*>'

# Hashed assets: exactly ONE Cache-Control, the immutable one — never a
# comma-joined "max-age=0 …, max-age=31536000" (docs/09 §4).
curl -sI https://softharbor.net/_astro/<any-hashed-file> | grep -i cache-control

# The Worker answers /api/verify (D25): a junk token → 403 {"error":"rejected"};
# 503 "not_configured" = runtime secret missing; a bare 405 = Worker not live.
curl -s -X POST -H 'Origin: https://softharbor.net' -H 'Content-Type: application/json' \
     -d '{"token":"x"}' https://softharbor.net/api/verify

# Speed Brain off: no Speculation-Rules header (§9).
curl -sI https://softharbor.net/ | grep -i speculation-rules
```

Plus: hstspreload.org checker (informational until P3), a DMARC report
after week 1, and GSC URL Inspection post-launch.
