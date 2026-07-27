# 04 — Data Schema

## 1. Source of truth

`src/content.config.ts`. Everything else (pages, indexes, exports, feed) is
derived. Schema version: **1** (bump requires migration note in docs/15).

```ts
// src/content.config.ts
import { defineCollection, reference, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const HTTPS = z.string().url().startsWith('https://');

export const categories = defineCollection({
  loader: file('./src/data/categories.json'),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.object({ en: z.string(), vi: z.string() }),
    icon: z.string(),            // lucide icon name, e.g. "globe"
    order: z.number().int(),
  }),
});

export const apps = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/apps' }), // id = filename = slug
  schema: z.object({
    name: z.string().min(1).max(60),
    developer: z.string().min(1).max(80),         // who publishes it — docs/06 §5
    logo: z.string().regex(/^(simple-icons:[a-z0-9]+|local:[a-z0-9-]+\.(svg|webp))$/),
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
  }).strict(),
});

export const collections = { apps, categories };
```

`.strict()` is deliberate: unknown keys fail the build, so the export
contract (docs/03 §6) never silently grows.

## 2. Field reference

| Field | Type | Rules & meaning |
|---|---|---|
| *(slug)* | filename | `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 40 chars, permanent once shipped (it is the URL and the RSS guid). Renaming = new file + `_redirects` entry. |
| `name` | string | Official product name, original casing ("7-Zip", "paint.net"). |
| `logo` | string | `simple-icons:<slug>` preferred (build-time SVG, inherits `currentColor`); else `local:<file>` in `src/assets/logos/` — SVG preferred, else WebP ≤ 512 px, ≤ 50 KB, transparent bg. Usage rules: docs/14 §3d. |
| `developer` | string 1–80 | **Required.** The person, company, or project that publishes the software, as *they* write it ("Igor Pavlov", "Serif (Europe) Ltd", "VSCodium contributors"). Rendered on the detail page (docs/06 §5). This is a trust signal, not decoration: it lets a reader confirm the entry names the real vendor before following `links.download`. Not a legal-entity lookup — use the name on the official homepage. The field is singular; there is no separate `publisher`. |
| `summary.en/.vi` | string 20–160 | Original wording (hard rule 8). Pattern: *what it is* + *one differentiator*. No superlatives, no emoji. |
| `categories` | ref[] 1–3 | Ids from §4; first entry = primary (drives detail-page breadcrumb). |
| `tags` | string[] ≤ 8 | Free-form kebab-case, searchable; e.g. `portable`, `cli`, `no-install`. |
| `platforms` | enum[] | Desktop only. An app available elsewhere still lists only its desktop targets. |
| `pricing` | enum | See §5 — this encodes inclusion criterion C2/C3. |
| `license` | SPDX \| null | `null` = closed source (renders no badge). Use exact SPDX ids: `GPL-3.0-only`, `MIT`, `LGPL-2.1-or-later`… "Open Source" UI badge = `license !== null`. |
| `links.homepage` | https URL | Developer's official domain. |
| `links.repo` | https URL \| null | Official GitHub/GitLab/Codeberg… only. |
| `links.download` | https URL | Official download page (page, not direct binary, when both exist). |
| `security.status` | enum | `unverified` (default at entry) · `clean` (vetting checklist passed, docs/09 §6) · `flagged` (blocks listing → quarantine, docs/03 §5). |
| `security.evidence` | URL \| null | VirusTotal scan of the download page/file, or vendor advisory. Required when `flagged`; recommended when `clean`. |
| `security.checkedAt` | date | Date the status was last verified — rendered on the card ("checked 2026-07-15"). |
| `addedAt` / `updatedAt` | date | Drive RSS + "Latest additions" + sort. |

## 3. Pricing semantics (rulings)

| Value | Meaning | Examples |
|---|---|---|
| `free` | Fully usable forever at $0. Includes freemium products **whose free tier alone is self-sufficient** even if the paid upgrade is a subscription (criterion C3). | VLC, 7-Zip, Bitwarden (free tier) |
| `free-onetime` | Free tier + optional **single lifetime payment** unlock. | — (tag on entry) |
| `onetime` | Paid once, perpetual license, optional paid major upgrades allowed. | Affinity Photo, Sublime Text |
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

`src/data/apps/7-zip.json` — free, open source:

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
  "security": { "status": "clean", "evidence": null, "checkedAt": "2026-07-15" },
  "addedAt": "2026-07-15"
}
```

`src/data/apps/affinity-photo.json` — one-time purchase, closed source:

```json
{
  "name": "Affinity Photo",
  "developer": "Serif (Europe) Ltd",
  "logo": "simple-icons:affinityphoto",
  "summary": {
    "en": "Professional photo editor sold as a one-time purchase — a perpetual-license alternative to subscription editors.",
    "vi": "Trình chỉnh sửa ảnh chuyên nghiệp bán theo hình thức mua đứt một lần — thay thế cho các trình chỉnh sửa thuê bao."
  },
  "categories": ["graphics"],
  "tags": ["photo-editing", "raw"],
  "platforms": ["windows", "macos"],
  "pricing": "onetime",
  "license": null,
  "links": {
    "homepage": "https://affinity.serif.com",
    "repo": null,
    "download": "https://affinity.serif.com/photo/"
  },
  "security": { "status": "unverified", "evidence": null, "checkedAt": "2026-07-15" },
  "addedAt": "2026-07-15"
}
```

`src/data/apps/vscodium.json` — local logo fallback example:

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
  "tags": ["editor", "open-source-build"],
  "platforms": ["windows", "macos", "linux"],
  "pricing": "free",
  "license": "MIT",
  "links": {
    "homepage": "https://vscodium.com",
    "repo": "https://github.com/VSCodium/vscodium",
    "download": "https://github.com/VSCodium/vscodium/releases"
  },
  "security": { "status": "clean", "evidence": null, "checkedAt": "2026-07-15" },
  "addedAt": "2026-07-15"
}
```

## 6. Quarantine files

Schema-identical (§1) — the file simply lives in `data/quarantine/` and
keeps `status: "flagged"`. Reason/evidence/date live in the linked issue and
commit message (docs/03 §5), so restoring is a plain `git mv` + status edit.
