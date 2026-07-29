# 13 — Release & Operations

## 1. Versioning model

The **site** deploys continuously from `main` — no version numbers on
content. Git tags mark milestones only: `v1.0.0` at public launch, minor
tags when a feature phase ships (they trigger `notify.yml`). Data changes
never tag. `CHANGELOG.md` (Keep-a-Changelog) records feature work, not app
additions — the RSS feed *is* the data changelog.

## 2. Launch checklist (gate for calling it v1.0.0)

> **Status 2026-07-28.** The infra section below is **green** — verified
> against production after the M6 deploy: `http→https` 301, `www→apex` 301 with
> path and query preserved, apex 200, branded 404, HSTS present, no
> `X-Robots-Tag`, workers.dev route dead (404), DMARC resolving, and
> `/api/apps.json`, `/rss.xml`, `/sitemap-index.xml`, `security.txt` all 200.
>
> **What still blocks v1.0.0 is content, not infrastructure:** the dataset
> holds 5 entries against the 32 in §4, and every one is
> `security.status: "unverified"` because the §6 vetting checklist has not been
> run against them. Tagging v1.0.0 before that would put the project's own
> honesty claim (hard rule 4) on a dataset nobody has checked.

Infra & correctness

- [ ] Spikes S1–S5 all passed (docs/11 §3); fallbacks recorded if taken
- [ ] `pnpm build` clean; validate:data clean; i18n parity clean
- [ ] `curl -I` shows full header set (docs/09 §4); observatory scan grade A
- [ ] `/apps/nonexistent` → HTTP 404 branded page; airplane-mode → offline page
- [ ] `/api/apps.json`, `/rss.xml`, `/sitemap-index.xml` valid (W3C feed validator)
- [ ] **PWA icons exist** — `public/icons/` 192, 512 and maskable PNGs, wired
      into the manifest. `favicon.svg` is a placeholder anchor mark and the
      manifest ships `icons: []` until the real wordmark lands (docs/06 §4),
      so there is currently no install prompt.
- [ ] `security.txt` `Expires` is in the future (annual task, §6)
- [ ] Domain package verified end-to-end (docs/16 §10 command block):
      DNSSEC signing, `www` → 301 apex with path+query, http → https,
      workers.dev main route dead, HSTS phase P1 header present,
      DMARC record resolves, `contact@softharbor.net` receives a test mail
- [x] No stray `workers.dev` references in the repo. `git grep workers.dev`
      outside `docs/` and the lockfile should return only **`CLAUDE.md`'s
      hosting summary** — that and docs/16 §3 are deliberate descriptions of
      the disabled route, not live URLs. Anything else is a real stray.
- [ ] **`X-Robots-Tag: noindex` removed from `public/_headers`.** It was added
      pre-launch so an empty site could be deployed without being indexed;
      leaving it in would silently keep the finished site out of every search
      engine. Verify with `curl -sI https://softharbor.net/ | grep -i robots`
      returning nothing.
- [ ] Search Console **Domain property** for `softharbor.net` verified;
      sitemap `https://softharbor.net/sitemap-index.xml` submitted; Bing
      imported from GSC; Crawler Hints enabled (docs/16 §8)

Content & legal

- [ ] All seed apps merged (§4 — 32 as proposed), every entry vetted
      (docs/09 §6), zero `flagged`, summaries proof-read in both locales
- [ ] Legal drafts reviewed by Kokone (H6), contact email live (H5),
      `LEGAL_VERSION` set; gate tested on a fresh profile in both locales
- [ ] LICENSE (GPL-3.0) + LICENSE-DATA.md present; footer license line correct

Quality bar

- [ ] Lighthouse mobile on `/apps`: Performance ≥ 95 · A11y = 100 ·
      Best Practices = 100 · SEO = 100
- [ ] JS on `/apps` < 80 KB gzip (docs/00 §2.5)
- [ ] Both gates above are **enforced in CI**, not just checked once here —
      Lighthouse CI (assert A11y = 100) and a `size-limit` budget on the
      `/apps` bundle, wired into `ci.yml`'s `gates` job (docs/12 §2). A
      launch-day-only check is a number that starts regressing on day two.
- [ ] VoiceOver (macOS) + NVDA (Windows) pass on grid, filter sheet, gate
- [ ] Vietnamese diacritics visually clean in all three fonts at all scale
      steps (docs/06 §3)

## 3. Launch-day sequence

1. Merge the final seed PR → auto-deploy.
2. Tag `v1.0.0`, publish GitHub Release (notes = feature summary EN) →
   `notify.yml` fires the cross-poster once for the launch itself.
3. Manual posts where the cron doesn't reach (Discord announcement channels
   with role pings, pinned messages).
4. Enable the RSS→notify.py cron for ongoing per-app announcements (§5).

## 4. Seed list — 32 launch apps (proposed; H7 approves)

Balanced across the 12 categories; every entry must still pass vetting
individually. `(1)` = onetime, `(f)` = free with C3 ruling noted.

**Count — superseded 2026-07-29.** The table below was the original **32
distinct apps** (7-Zip is listed twice, primary category `utilities` and also
under `file-management`; counted once). The seed that actually shipped is
**290 apps**, imported in one batch under D24. The table is kept as the
record of what was originally proposed to H7, not as the current dataset —
`src/data/apps/` is the only authority for that.

Of the 12 categories, **`communication` is now the only empty one**;
Thunderbird from the table below is the obvious entry to add. Whatever the
final number, it must be updated here and in §2's checklist together.

| Category | Apps |
|---|---|
| browser | Firefox · Brave |
| graphics | GIMP · Krita · Inkscape · paint.net · **Affinity Photo (1)** |
| developer-tools | Git · Windows Terminal |
| ide-editor | VS Code · VSCodium · Notepad++ · **Sublime Text (1)** |
| media | VLC · OBS Studio · mpv · Audacity · HandBrake |
| productivity | Obsidian (f) · LibreOffice |
| utilities | 7-Zip · Everything · ShareX · PowerToys |
| security-privacy | KeePassXC · Bitwarden (f) · VeraCrypt |
| communication | Thunderbird |
| file-management | (7-Zip primary) · FreeFileSync |
| gaming | Playnite |
| system | Rufus · Ventoy |

Notes for vetting: Obsidian — free for personal use incl. commercial since
2025 policy change, sync is a paid add-on → `free` with C3 note; Bitwarden —
free tier self-sufficient → `free` (C3); Sublime Text — perpetual license →
`onetime`. Rulings land in the decision log on merge.

## 5. Ongoing announcements (notify.py integration)

The existing cross-poster consumes `/rss.xml` (guid = slug, docs/03 §7) on
its GitHub Actions cron and posts new items to Telegram, Discord webhook,
Bluesky, Mastodon, X, Facebook. SoftHarbor-side contract: never reuse a
slug; never backdate `addedAt`; feed stays deterministic. Message template
(configured on the notify.py side):
`🆕 {name} — {summary.en} · {site}/apps/{slug}`.

## 6. Operating cadence

| Cadence | Task |
|---|---|
| per-PR | vetting checklist on new/changed entries |
| daily (auto) | quarantine sweep (docs/12 §4) |
| weekly (auto) | link-check triage — fix, replace with official mirror, or flag |
| weekly (auto) | Renovate window + osv findings |
| monthly (manual, ~30 min) | re-verify the 10 oldest `checkedAt` entries; refresh dates |
| monthly (manual, ~10 min) | GSC review: Coverage, Core Web Vitals, hreflang errors; skim DMARC reports (docs/16 §6/§8) |
| **annually (manual, ~2 min)** | **Roll `Expires` in `public/.well-known/security.txt` forward one year** (docs/09 §5). An expired `security.txt` is treated as invalid by scanners and researchers — and nothing else in this repo would notice. |
| once, post-launch | HSTS phase transitions P1 → P2 (+2 weeks) → optional P3/preload (H9) — docs/16 §5 |
| quarterly | review category taxonomy & criteria rulings; prune tags |

## 7. Incident playbook (listed app turns out harmful)

1. Set `flagged` (PR or label) → workflow quarantines within the day; site
   updates on merge.
2. Tracking issue gets evidence links; entry's page 404s (acceptable — the
   RSS item remains historical, do not rewrite the feed).
3. If users were plausibly exposed (app was `clean` at the time), post a
   notice via the announcement channels referencing the issue.
4. Post-mortem line in the decision log: which checklist step failed, and
   whether §6 cadence or docs/09 §6 needs tightening.
