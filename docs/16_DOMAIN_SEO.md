# 16 — Custom Domain & SEO Operations (`softharbor.net`)

> Added in suite v1.1 (2026-07-20) after the domain purchase. This doc owns
> everything zone-level: DNS, redirects, TLS/HSTS, email, robots/sitemap,
> structured data, Search Console, and the features we deliberately keep
> off. Platform facts below (plan gating, config keys) were re-verified
> against Cloudflare docs on 2026-07-20.
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
| N4 | Zone plan | **Free** (Workers Paid is account-level and unrelated). Consequence: Cloudflare **Custom Errors stays unavailable** (paid-zone feature) → our `/errors/*` templates remain dormant |
| N5 | HSTS | Zone-level, phased rollout (§5) — **not** in `_headers` |
| N6 | Rate limiting & Bot Fight Mode | **OFF** at launch, with a ready-made activation recipe (§9) |
| N7 | Contact email | `contact@softharbor.net` via Cloudflare Email Routing (§6) — resolves H5 |
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
| *(auto)* | `softharbor.net` | Worker custom domain | ☁️ | created by `wrangler deploy` (§3) — do not hand-edit |
| AAAA | `www` | `100::` | ☁️ | placeholder so the redirect rule (§4) has a proxied hostname to fire on (`A 192.0.2.1` works too) |
| MX ×3 + TXT (SPF) | `@` | added by Email Routing wizard | — | §6 |
| TXT | `_dmarc` | §6 policy | — | anti-spoofing |
| TXT | `@` | `google-site-verification=…` | — | GSC Domain property (§8) |

No other records. CAA is optional hardening — if added, it must include
every CA Cloudflare Universal SSL may use (check their current CA list at
that time); safest v1 choice is to add none.

### 2.3 TLS settings (SSL/TLS tab)

Universal SSL: automatic (nothing to do). Edge Certificates: **Minimum TLS
1.2**, TLS 1.3 **On**, **Always Use HTTPS On**. Encryption mode: Full
(Strict) as zone default hygiene — moot for the Worker route (TLS
terminates at the edge; there is no origin), relevant only if other records
ever appear.

## 3. Attaching the Worker (IaC-first)

`wrangler.jsonc` delta (full file reference: docs/02 §7):

```jsonc
{
  "name": "softharbor",
  "compatibility_date": "2026-07-15",
  "assets": { "directory": "./dist", "not_found_handling": "404-page" },
  "routes": [
    { "pattern": "softharbor.net", "custom_domain": true }
  ],
  "workers_dev": false,     // kills softharbor.<account>.workers.dev
  "preview_urls": true      // explicit — defaults to workers_dev's value
}
```

`wrangler deploy` then creates the apex DNS record and provisions the
certificate; the custom domain appears under the Worker's *Domains &
Routes*. Keep the route in config (not clicked in the dashboard) so a fresh
clone reproduces production exactly.

Preview URLs after this change: PR previews keep working at
`<version-prefix>-softharbor.<account>.workers.dev`. They are unlinked,
short-lived, and carry no sitemap — indexing risk accepted (a static
`_headers` file cannot vary `X-Robots-Tag` by host). Never link a preview
URL anywhere public except the PR comment.

## 4. Redirects

| Layer | Owner | Used for |
|---|---|---|
| Zone **Redirect Rules** (run before the Worker, all plans) | R1 below | host-level: `www` → apex |
| **Always Use HTTPS** | zone setting | `http://` → `https://` |
| `public/_redirects` (static assets) | app | path-level only: future slug renames (docs/04 §2) — cannot match hosts |

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

## 6. Email on the domain (+ anti-spoofing)

**Receiving** — Cloudflare **Email Routing** (free): Email → Email Routing
→ enable → verify the personal destination inbox → create address
`contact@softharbor.net` → forward. The wizard writes the MX records and an
SPF TXT (`v=spf1 include:_spf.mx.cloudflare.net ~all`). This resolves
action item **H5**: update `<contact-email>` → `contact@softharbor.net` in
docs/14 drafts and `security.txt` before launch.

**Anti-spoofing** — add `_dmarc` TXT:
`v=DMARC1; p=quarantine; rua=mailto:contact@softharbor.net; fo=1`
→ after ~1 month of clean reports, tighten to `p=reject`.

**Sending** — the domain sends nothing in v1 (Email Routing is
receive-only; replies go out from the personal mailbox). If a send-as setup
(e.g. Gmail SMTP for `contact@`) is ever added, revisit SPF/DKIM/DMARC in
the same PR — the current policy would junk such mail by design.

## 7. On-page SEO

- **`site`**: `https://softharbor.net` in `astro.config.ts` — canonicals,
  hreflang (docs/07 §6), sitemap, RSS links, and OG URLs all derive from
  it. Grep the repo for `workers.dev` before launch; only §3's preview note
  should remain.
- **`public/robots.txt`** (final):

  ```
  User-agent: *
  Allow: /

  Sitemap: https://softharbor.net/sitemap-index.xml
  ```

- **noindex surface:** `/offline` and `/errors/*` get
  `<meta name="robots" content="noindex">` (reachable but meaningless in
  SERPs). The 404 page needs nothing — its status code excludes it. Legal
  pages stay indexable.
  **They must also be excluded from the sitemap**, via the `sitemap({ filter })`
  option in `astro.config.ts` (docs/02 §4). `noindex` alone is not enough:
  submitting a noindex'd URL makes GSC report *"Submitted URL marked
  noindex"* on every crawl, which buries the hreflang errors we actually
  want to see (§8 monitoring cadence).
- **Structured data (JSON-LD):**
  - `/apps/[slug]`: `SoftwareApplication` — `name`, `description`
    (locale summary), `operatingSystem` (joined platforms),
    `applicationCategory` (primary category label EN), `url` (the
    SoftHarbor page), `sameAs: [homepage, repo]`, and `offers { "@type":
    "Offer", "price": "0", "priceCurrency": "USD" }` **only when
    `pricing === "free"`** — we never state amounts for `onetime`
    (truthfulness > rich-result greed). Plus `BreadcrumbList`
    (Home → category → app).
  - Site-wide: one `WebSite` node on `/`. No `SearchAction` in v1 (search
    is client-side; a `?q=` deep-link is a cheap post-v1 addition — docs/15
    §2).
  - JSON-LD `<script type="application/ld+json">` blocks are data blocks,
    not executable scripts, so the strict CSP (docs/09 §4) does not need
    hashes for them — verify once in the S1 spike build and note it there.
- **OG/meta:** `og:site_name`, `og:title`, `og:description` (locale
  summary), `og:url` (canonical), `og:locale` + `og:locale:alternate`,
  `twitter:card=summary`. Per-app OG images stay post-v1 (docs/15 §2).

## 8. Search-engine plumbing

**Google Search Console — Domain property** (covers apex + www + both
schemes):

1. GSC → Add property → **Domain** → `softharbor.net`.
2. Copy the `google-site-verification=…` TXT → Cloudflare DNS (name `@`)
   → Verify (propagation is usually minutes).
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
| **Rate limiting** | OFF. Static assets are unbilled and edge-served — there is nothing costly to protect; and on the Free zone the Block action serves **Cloudflare's default 429 page** (custom responses are Business+), undermining our error-page polish. | Free zone includes **1 rule**: Security → WAF → Rate limiting rules → e.g. `(http.host eq "softharbor.net")`, 100 req / 10 s per IP, Block 1 min. Accept the default 429 page, or upgrade zone for custom response. |
| **Bot Fight Mode** | OFF. It challenges automated clients — which would break exactly what we publish for automation: `/api/apps.json` consumers and the `notify.py` RSS cron. | Only with a scoped WAF exception for `/api/*` and `/rss.xml` — and only in response to actual abuse. |
| **Cloudflare Custom Errors** | Unavailable on Free zone (paid-plans feature; also never applies to 500/501/503/505). `/errors/{403,429,500}` templates stay **dormant** as designed. | Upgrade zone to Pro → Rules → Custom Error Rules → point 403/429 at the templates. Decision logged if taken. |
| **Cache tuning / Page Rules / Snippets** | Defaults. Workers Static Assets already serves from the edge; `_headers` (docs/09 §4) owns per-path `Cache-Control`. | — |

## 10. Rollout sequence & verification

Order (fits between M5 and M6 of docs/15 — roughly one focused day):

1. Zone added → NS live (external registrar) → DNSSEC on.
2. Email Routing + DMARC → `contact@softharbor.net` receiving → update
   docs/14 + `security.txt` (H5 ✅).
3. `wrangler.jsonc` routes/workers_dev/preview_urls change → deploy →
   apex live.
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

# CSP must show script-src 'self' with NO sha256- token (docs/09 §4, D18).
curl -sI https://softharbor.net/ | grep -i content-security-policy

# Hashed assets must win the immutable cache rule over the /* default.
curl -sI https://softharbor.net/_astro/<any-hashed-file> | grep -i cache-control
```

Plus: hstspreload.org checker (informational until P3), a DMARC report
after week 1, and GSC URL Inspection post-launch.
