# 13 — Release & Operations

## 1. Versioning model

The **site** deploys continuously from `main` — no version numbers on
content. Git tags mark milestones only: `v1.0.0` at public launch, minor
tags when a feature phase ships (they trigger `notify.yml`). Data changes
never tag. `CHANGELOG.md` (Keep-a-Changelog) records feature work, not app
additions — the RSS feed *is* the data changelog.

## 2. Launch checklist (gate for calling it v1.0.0)

Infra & correctness

- [ ] Spikes S1–S5 all passed (docs/11 §3); fallbacks recorded if taken
- [ ] `pnpm build` clean; validate:data clean; i18n parity clean
- [ ] `curl -I` shows full header set (docs/09 §4); observatory scan grade A
- [ ] `/apps/nonexistent` → HTTP 404 branded page; airplane-mode → offline page
- [ ] `/api/apps.json`, `/rss.xml`, `/sitemap-index.xml` valid (W3C feed validator)
- [ ] Domain package verified end-to-end (docs/16 §10 command block):
      DNSSEC signing, `www` → 301 apex with path+query, http → https,
      workers.dev main route dead, HSTS phase P1 header present,
      DMARC record resolves, `contact@softharbor.net` receives a test mail
- [ ] No stray `workers.dev` references in the repo
      (`git grep workers.dev` → only docs/16 §3's preview note)
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

**Count.** The table below holds **32 distinct apps**, not the "30" earlier
drafts claimed — 7-Zip is listed twice (primary category `utilities`, also
shown under `file-management`) and is counted once. Two categories carry a
single genuine entry each (`communication`: Thunderbird; `file-management`:
FreeFileSync) — thin but acceptable for v1, and worth noting to H7 as the
first place to add if the list is trimmed elsewhere. Whatever H7 approves,
the number here and in §2's checklist must be updated together.

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
