# 04 — Data Schema

## 1. Source of truth

`src/content.config.ts`. Everything else (pages, indexes, exports, feed) is
derived. Schema version: **1** (bump requires migration note in docs/15).

```ts
// src/content.config.ts
import { defineCollection, reference, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

/** Today in UTC, at build time: data dated after the build is a typo. */
const TODAY = new Date().toISOString().slice(0, 10);

// A REAL calendar date, not in the future — the regex alone let
// `2026-02-31` through; round-tripping through Date catches it.
const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
  .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d,
          { message: 'not a real calendar date' })
  .refine((d) => d <= TODAY, { message: 'date is in the future' });
const HTTPS = z.url().refine((u) => u.startsWith('https://'), { message: 'https:// only' });

const categories = defineCollection({
  loader: file('./src/data/categories.json'),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.object({ en: z.string(), vi: z.string() }),
    icon: z.string(),            // lucide icon name, e.g. "globe"
    order: z.number().int(),
  }),
});

const apps = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/apps' }), // id = filename = slug
  schema: z.object({
    name: z.string().min(1).max(60),
    developer: z.string().min(1).max(80),         // who publishes it — docs/06 §5
    logo: z.string().regex(/^(simple-icons:[a-z0-9]+|local:[a-z0-9-]+\.svg|monogram)$/),
    summary: z.object({
      en: z.string().min(20).max(160),
      vi: z.string().min(20).max(160),
    }),
    categories: z.array(reference('categories')).min(1).max(3),
    tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8).default([]),
    platforms: z.array(z.enum(['windows', 'macos', 'linux'])).min(1),
    pricing: z.enum(['free', 'free-onetime', 'onetime']),
    license: z.string().min(2).nullable(),        // SPDX id or null (closed source)
    links: z.object({
      homepage: HTTPS,
      repo: HTTPS.nullable(),
      download: HTTPS,
    }),
    security: z.object({
      status: z.enum(['clean', 'flagged', 'unverified']),
      evidence: HTTPS.nullable(),                 // VirusTotal / vendor advisory
      checkedAt: DATE,
    }),
    addedAt: DATE,
    updatedAt: DATE.optional(),
  })
  .strict()
  .superRefine((app, ctx) => {
    // A status that makes a claim must link the evidence behind it.
    if (app.security.status !== 'unverified' && app.security.evidence === null)
      ctx.addIssue({ code: 'custom', path: ['security', 'evidence'],
        message: `status "${app.security.status}" requires an evidence URL` });
    if (app.updatedAt && app.updatedAt < app.addedAt)
      ctx.addIssue({ code: 'custom', path: ['updatedAt'],
        message: `updatedAt ${app.updatedAt} precedes addedAt ${app.addedAt}` });
  }),
});

export const collections = { apps, categories };
```

`.strict()` is deliberate: unknown keys fail the build, so the export
contract (docs/03 §6) never silently grows. The two refinements are v1.1:
"no known warnings" is only worth something when the reader can check it
(hard rule 4) and a flag needs its reason — CONTRIBUTING closed `clean`
without evidence on sight, but nothing enforced it; `unverified` claims
nothing, so its `evidence` stays optional. Cross-file rules (slug format,
duplicates, link provenance, invisible characters, quarantine) are L2,
`scripts/validate-data.mjs` (docs/03 §2).

## 2. Field reference

| Field | Type | Rules & meaning |
|---|---|---|
| *(slug)* | filename | `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 40 chars, permanent once shipped (it is the URL and the RSS guid). Renaming = new file + `_redirects` entry. |
| `name` | string | Official product name, original casing ("7-Zip", "paint.net"). |
| `logo` | string | `simple-icons:<slug>` preferred (build-time SVG, inherits `currentColor`); else `local:<file>.svg` in `src/assets/logos/`, from the vendor's own brand assets; else `monogram`, which renders the app's initials because no mark is available (D23). Usage rules: docs/14 §3d. |
| `developer` | string 1–80 | **Required.** The person, company, or project that publishes the software, as *they* write it ("Igor Pavlov", "Serif (Europe) Ltd", "VSCodium contributors"). Rendered on the detail page (docs/06 §5). This is a trust signal, not decoration: it lets a reader confirm the entry names the real vendor before following `links.download`. Not a legal-entity lookup — use the name on the official homepage. The field is singular; there is no separate `publisher`. |
| `summary.en/.vi` | string 20–160 | Original wording (hard rule 8). Pattern: *what it is* + *one differentiator*. No superlatives, no emoji. |
| `categories` | ref[] 1–3 | Ids from §4; first entry = primary (drives detail-page breadcrumb). |
| `tags` | string[] ≤ 8 | Free-form kebab-case, searchable; e.g. `portable`, `cli`, `no-install`. |
| `platforms` | enum[] | Desktop only. An app available elsewhere still lists only its desktop targets. |
| `pricing` | enum | See §5 — this encodes inclusion criterion C2/C3. |
| `license` | SPDX \| null | `null` = closed source (renders no badge). Use exact SPDX ids: `GPL-3.0-only`, `MIT`, `LGPL-2.1-or-later`… "Open Source" UI badge = `license !== null`. |
| `links.homepage` | https URL | Developer's official domain. L2 refuses download portals, IDN (`xn--`) hosts and tracking parameters (docs/03 §2). |
| `links.repo` | https URL \| null | Official GitHub/GitLab/Codeberg… only. |
| `links.download` | https URL | Official download page (page, not direct binary, when both exist). |
| `security.status` | enum | `unverified` (default at entry) · `clean` (vetting checklist passed, docs/09 §6) · `flagged` (blocks listing → quarantine, docs/03 §5). |
| `security.evidence` | https URL \| null | VirusTotal scan of the download page/file, or vendor advisory. **Required by the schema when `clean` or `flagged`** (since v1.1); optional for `unverified`, though held entries carry theirs too. Linked from the detail page ("View scan", docs/06 §5). |
| `security.checkedAt` | date | Date of the latest scan behind the status — rendered on the card ("checked 30 Jul 2026"). The full docs/09 §6 checklist runs when an entry is first marked `clean` and whenever its links change; `vt-recheck.yml` re-scans at least every 90 days and moves this date (never `addedAt`/`updatedAt`). A real date, not in the future; `validate:data` warns once it is older than 180 days. |
| `addedAt` / `updatedAt` | date | Drive RSS, the "Newest" sort and category-page order. Real dates, not in the future; `updatedAt` ≥ `addedAt`. |

## 3. Pricing semantics (rulings)

| Value | Meaning | Examples |
|---|---|---|
| `free` | Fully usable forever at $0. Includes freemium products **whose free tier alone is self-sufficient** even if the paid upgrade is a subscription (criterion C3). | VLC, 7-Zip, Bitwarden (free tier) — 296 entries |
| `free-onetime` | Free tier + optional **single lifetime payment** unlock. | FreeFileSync, eM Client, HWiNFO — 14 entries |
| `onetime` | Paid once, perpetual license, optional paid major upgrades allowed. | Sublime Text, REAPER, Total Commander — 16 entries |
| *(excluded)* | Subscription required for core desktop use; time-limited trials; crippled demos. | Adobe CC, MS 365 |

Ambiguous cases → decision log (docs/15 §4) before merge.

## 4. Category registry (initial 12)

`src/data/categories.json` — id · EN · VI · lucide icon:

| id | en | vi | icon |
|---|---|---|---|
| `browser` | Browsers | Trình duyệt | `globe` |
| `graphics` | Graphics & Design | Đồ hoạ & Thiết kế | `palette` |
| `developer-tools` | Developer Tools | Công cụ lập trình | `terminal` |
| `ide-editor` | IDEs & Editors | IDE & Trình soạn thảo | `code` |
| `media` | Audio & Video | Âm thanh & Video | `clapperboard` |
| `productivity` | Productivity | Năng suất | `list-checks` |
| `utilities` | Utilities | Tiện ích | `wrench` |
| `security-privacy` | Security & Privacy | Bảo mật & Riêng tư | `shield` |
| `communication` | Communication | Liên lạc | `message-circle` |
| `file-management` | File Management | Quản lý tệp | `folder` |
| `gaming` | Gaming Tools | Công cụ chơi game | `gamepad-2` |
| `system` | System Tools | Công cụ hệ thống | `cpu` |

Adding a category = PR editing this file + decision-log line (keeps the
taxonomy from sprawling).

## 5. Example files

`src/data/apps/7-zip.json` — free, open source (the shipped file):

```json
{
  "name": "7-Zip",
  "developer": "Igor Pavlov",
  "logo": "simple-icons:7zip",
  "summary": {
    "en": "File archiver with high-ratio 7z compression and support for dozens of archive formats.",
    "vi": "Trình nén và giải nén tệp với định dạng 7z tỷ lệ nén cao, hỗ trợ hàng chục định dạng lưu trữ."
  },
  "categories": ["file-management", "utilities"],
  "tags": ["archiver", "compression", "portable"],
  "platforms": ["windows", "linux"],
  "pricing": "free",
  "license": "LGPL-2.1-or-later",
  "links": {
    "homepage": "https://www.7-zip.org",
    "repo": null,
    "download": "https://www.7-zip.org/download.html"
  },
  "security": {
    "status": "clean",
    "evidence": "https://www.virustotal.com/gui/url/273d0beedb411e020dd6ce34a46330b626a4ed56df427f806c4c552ea5c287e7",
    "checkedAt": "2026-07-30"
  },
  "addedAt": "2026-07-28"
}
```

`src/data/apps/sublime-text.json` — one-time purchase, closed source (the
shipped file). It replaces the earlier Affinity Photo example: the catalogue
lists today's Affinity (Canva) as `free`.

```json
{
  "name": "Sublime Text",
  "developer": "Sublime HQ Pty Ltd",
  "logo": "simple-icons:sublimetext",
  "summary": {
    "en": "Native code editor known for fast startup, multiple cursors and project-wide Goto Anything search.",
    "vi": "Trình soạn thảo mã gốc, khởi động nhanh, hỗ trợ nhiều con trỏ và tìm kiếm Goto Anything toàn dự án."
  },
  "categories": ["ide-editor", "developer-tools"],
  "tags": ["native", "multiple-cursors", "plugins", "cross-platform"],
  "platforms": ["windows", "macos", "linux"],
  "pricing": "onetime",
  "license": null,
  "links": {
    "homepage": "https://www.sublimetext.com",
    "repo": null,
    "download": "https://www.sublimetext.com/download"
  },
  "security": {
    "status": "clean",
    "evidence": "https://www.virustotal.com/gui/url/50dc606906fd62b2283cc55dde1d5f1d85407d0a38a1883ef35c81ede28f0c49",
    "checkedAt": "2026-07-30"
  },
  "addedAt": "2026-07-28"
}
```

`src/data/apps/vscodium.json` — logo fallback example. `local:` is for a
vendor-official asset committed to `src/assets/logos/`; when neither Simple
Icons nor the vendor gives us a usable mark, the value is `monogram` instead
and the renderer draws the initials (D23). VSCodium itself now resolves to
`simple-icons:vscodium` — the `local:` value below is illustrative only:

```json
{
  "name": "VSCodium",
  "developer": "VSCodium contributors",
  "logo": "local:vscodium.svg",
  "summary": {
    "en": "Community build of the VS Code source with Microsoft telemetry and branding removed.",
    "vi": "Bản dựng cộng đồng từ mã nguồn VS Code, đã loại bỏ telemetry và thương hiệu của Microsoft."
  },
  "categories": ["ide-editor", "developer-tools"],
  "tags": ["editor", "open-source-build", "no-telemetry"],
  "platforms": ["windows", "macos", "linux"],
  "pricing": "free",
  "license": "MIT",
  "links": {
    "homepage": "https://vscodium.com",
    "repo": "https://github.com/VSCodium/vscodium",
    "download": "https://github.com/VSCodium/vscodium/releases"
  },
  "security": {
    "status": "clean",
    "evidence": "https://www.virustotal.com/gui/url/0f460f5b6220092a8f378b0ad71922d549d99331e352143c1ef9e2ed4f83f0a5",
    "checkedAt": "2026-07-30"
  },
  "addedAt": "2026-07-28"
}
```

As of v1.1 no entry uses `local:` (`src/assets/logos/` does not exist yet):
118 entries use `simple-icons:`, 208 `monogram`.

## 6. Quarantine files

Schema-identical (§1) — the file simply lives in `data/quarantine/` and
keeps `status: "flagged"` (which, since v1.1, also means it carries an
`evidence` URL). Reason/evidence/date live in the linked issue and commit
message (docs/03 §5). `pnpm quarantine` moves a flagged file there;
restoring is a reviewed PR that moves it back (`git mv`) and edits the
status — `validate:data` refuses a quarantined file that no longer says
`flagged`, and a slug that is live and quarantined at once.
