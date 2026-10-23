# 14 — Legal (licensing · gate · bilingual drafts)

> ⚠️ These drafts are templates prepared by the project, **not legal
> advice**. Kokone approved them before the first public deploy (H6,
> 2026-07-28). The site URL is final (`https://softharbor.net`). Since
> 2026-10-21 (D27) there is **one contact address per purpose** at
> `@poli0981.dev` — the table in Part 2 — and `contact@softharbor.net` is
> retired everywhere. Each document is its own page under `/legal/*` (EN)
> and `/vi/legal/*` (VI); English is canonical (docs/07 §8). The shipped
> wording lives in `src/components/legal/*.astro` (Part 3); every document
> carries its **own** "Last updated" date (`LEGAL_UPDATED`) — all six read
> 2026-10-21 as of v1.1.

## Part 1 — Licensing model

| Scope | License | File |
|---|---|---|
| Code (everything except below) | **GPL-3.0-only** | `LICENSE` (add via GitHub license picker — full text, unmodified) |
| Dataset `src/data/**` (app entries + category registry) | **CC BY-SA 4.0** | `LICENSE-DATA.md` |
| Docs `docs/**` | GPL-3.0-only (with the code) | — |

`LICENSE-DATA.md` (root, full draft):

```markdown
# Data License — CC BY-SA 4.0

The SoftHarbor dataset — all files under `src/data/` (app entries and the
category registry) and the published exports derived from them
(`/api/apps.json`, `/rss.xml`) — is licensed under the
Creative Commons Attribution-ShareAlike 4.0 International license
(CC BY-SA 4.0): https://creativecommons.org/licenses/by-sa/4.0/

**Attribution format:** "SoftHarbor contributors —
https://github.com/poli0981/softharbor (CC BY-SA 4.0)".

You may copy, redistribute, and adapt the dataset, including commercially,
provided you give the attribution above, link the license, indicate
changes, and license derivatives under CC BY-SA 4.0.

This license covers only the dataset's own text (summaries, curation,
structure). It does **not** cover the listed applications, their names, or
their logos, which belong to their respective owners (see /legal/trademarks).
Everything in this repository outside `src/data/` is licensed under
GPL-3.0-only — see `LICENSE`.

Questions about this license or how to attribute: copyright@poli0981.dev.
```

Provenance rule enforcing licensability: summaries are written from scratch
(hard rule 8) — never copied from vendors or Wikipedia — so the project can
actually grant CC BY-SA on them.

## Part 2 — Legal gate specification

**Purpose:** ensure every user has seen the disclaimer (T1) before using
the directory, in the CommandForge tradition, adapted to the web — and,
since v1.1, run a consent-first human check (D25).

**Two steps, one dialog.** Step 1 is the documents and "I understand and
accept". Step 2 — only after step 1 — is a Cloudflare Turnstile check whose
token the site's Worker confirms (docs/09 §4a, algorithm docs/05 §A9). A
returning visitor whose check has lapsed sees step 2 only.

| Aspect | Spec |
|---|---|
| Trigger | Shown when `sh:legal ≠ LEGAL_VERSION` (step 1, docs/05 §A7) **or** `sh:human` has lapsed (step 2 only) |
| Component | `ShLegalGate.svelte`, `client:load`, rendered by `Base.astro` on every non-exempt page — no `transition:persist`: every navigation is a full document load (docs/02 §6), so each page mounts its own gate with its own locale's strings |
| Exempt pages | Declared by the page with `gateExempt` — the island is simply not rendered: the six legal documents (EN + VI), `/contact` (EN + VI), `/404`, `/offline`, `/errors/*`. The gate links to the very documents it asks users to accept; error and offline pages must never dead-lock (Workers serves `404.html`, and the SW the offline page, at whatever URL was requested — the old path regex never matched them); a security or copyright notice must never wait behind acceptance |
| Content, step 1 | Locale-matched summary (below) + links to Disclaimer, Terms and Privacy under the locale's `/legal` base + a single accept button. No decline button: the copy explains that leaving the site is the alternative. A scale icon tile heads the step |
| Content, step 2 | "One moment" — what Turnstile is for, a spinner, and a link to the Privacy Policy's `#turnstile` section; the widget shows itself only if it needs a click (`interaction-only`). If the check cannot run: "The check could not run, so it was skipped. Come on in." for 1.5 s, then the gate closes. A shield icon tile heads the step |
| Step 2 outcome | Pass ⇒ `sh:human` = now + 48 h. Anything else — script blocked, widget error, 10 s timeout (120 s once it asks for a click), Worker 429/503/unreachable, three rejected challenges — ⇒ now + 1 h and the visitor is **let in** (fail open, docs/09 §4a) |
| Interaction | Native `<dialog>` opened with `showModal()`: focus trapped, everything behind it inert. Focus lands on the step's **heading**, so a screen reader reads the notice before any control. **Esc cannot dismiss it**: `closedby="none"`, `cancel` prevented while required, and if anything closes it early (Chromium's close watcher honours `preventDefault()` only after user activation) it re-opens at once. `body[data-sh-gate="open"]` makes global shortcuts (`/`) stand down (docs/06 §9). On phones (< 40 rem) it is a bottom sheet |
| Crawlers/SEO | Content renders underneath normally (dialog is an overlay, no cloaking, no JS-gated content); bots don't execute acceptance and don't need to. With JS off the island never runs and no gate appears |
| Persistence | Accept ⇒ `sh:legal = LEGAL_VERSION` (policy below). `sh:human` holds an expiry timestamp. localStorage unavailable ⇒ fail open per page/session (both records held in memory on `globalThis`) |
| Copy EN, step 1 | **Before you continue** — SoftHarbor is a link directory. We don't host downloads, and we can't guarantee third-party software. Statuses like "no known warnings" reflect checks on the date shown — verify anything you install. By continuing you accept the [Disclaimer], [Terms of Use] and [Privacy Policy]. → **I understand and accept** |
| Copy VI, step 1 | **Trước khi tiếp tục** — SoftHarbor là trang tổng hợp liên kết. Chúng tôi không lưu trữ tệp cài đặt và không thể bảo đảm cho phần mềm bên thứ ba. Trạng thái như "không có cảnh báo đã biết" chỉ phản ánh việc kiểm tra tại ngày ghi kèm — hãy tự xác minh trước khi cài đặt. Khi tiếp tục, bạn chấp nhận [Tuyên bố miễn trừ], [Điều khoản sử dụng] và [Chính sách quyền riêng tư]. → **Tôi hiểu và chấp nhận** |
| Copy EN, step 2 | **One moment** — A quick automatic check by Cloudflare Turnstile that you are a person, not a bot. It usually takes a second and needs nothing from you — see the [Privacy Policy]. |
| Copy VI, step 2 | **Chờ một chút** — Cloudflare Turnstile đang tự động kiểm tra để xác nhận bạn là người chứ không phải bot. Thường chỉ mất một giây và bạn không cần làm gì — xem [Chính sách quyền riêng tư]. |

All gate copy lives in the dictionaries (`gate.*`), resolved server-side for
the page's locale only and passed to the island as props — importing the
dictionaries into the island would bundle every key (docs/07 §3).

### `LEGAL_VERSION` policy

- `LEGAL_VERSION` (`src/lib/legal.ts`) is the version of the **accepted
  set** — Disclaimer, Terms of Use and Privacy Policy (`ACCEPTED_DOCS`),
  the three documents the gate asks for. **Bump it when one of those three
  changes materially**: the bump re-opens the gate for everyone, which is
  the intended behaviour. Typos and formatting do not bump it.
- `LEGAL_UPDATED` gives each of the **six** documents its own "Last
  updated" date, shown on its page. Trademarks, Third-party notices and the
  AI Disclosure move only their own date — they are informational and not
  part of what is accepted.
- **A test enforces the link** (`src/lib/legal.test.ts`): every accepted
  document's `LEGAL_UPDATED` must be ≤ `LEGAL_VERSION` — editing Privacy
  without bumping the version fails `pnpm test`. Every date must be a real
  day that has already happened.
- Equality, never ordering: any stored value other than the current one —
  older, *newer*, garbage — re-opens the gate (docs/05 §A7).
- History: **2026-07-28** (H6 approval of these drafts) · **2026-07-30**
  (while one constant still dated every page, it moved with the new AI
  Disclosure) · **2026-10-21** (v1.1: Privacy covers Web Analytics and the
  Turnstile check and names the operator; Terms gained the operator and a
  copyright-complaint procedure; nine EN/VI wording gaps and two false AI
  Disclosure claims fixed).

### Contacts (D27)

One address per purpose, all `@poli0981.dev`, all reaching the one
maintainer; `src/lib/contacts.ts` is the single source — pages, legal
documents and `security.txt` import from it or match it, never hard-code
another. Mail to `poli0981.dev` is delivered to a **Google-hosted** mailbox
(MX `aspmx.l.google.com`), which the Privacy Policy says (`#email`).

| Key | Address | Purpose |
|---|---|---|
| `security` | `security@poli0981.dev` | vulnerabilities; hijacked or malicious listing links (`security.txt`, `SECURITY.md`, Disclaimer) |
| `privacy` | `privacy@poli0981.dev` | the Privacy Policy, data requests |
| `legal` | `legal@poli0981.dev` | Terms, Disclaimer, anything else legal |
| `dmca` | `dmca@poli0981.dev` | copyright (DMCA-style) notices — the procedure in Terms `#copyright` |
| `takedown` | `takedown@poli0981.dev` | a developer asking for their listing or logo to be changed or removed; trademark complaints |
| `copyright` | `copyright@poli0981.dev` | licensing of the code (GPL-3.0-only) and the dataset (CC BY-SA 4.0) |
| `conduct` | `code@poli0981.dev` | Code of Conduct reports |
| `press` | `press@poli0981.dev` | press |
| `collab` | `collab@poli0981.dev` | collaboration |

Deliberately absent: `sponsor@` (a neutral directory takes no paid
placement) and `games@` (another project's). The Contact page
(`/contact`, `/vi/contact`) lists them in order of urgency and is
gate-exempt.

## Part 3 — Draft legal documents (EN canonical · VI courtesy)

Every VI page carries: *"Bản tiếng Việt chỉ nhằm mục đích tham khảo; nếu có
khác biệt, bản tiếng Anh được ưu tiên áp dụng."*

**Where the text lives.** The canonical wording is the shipped components,
`src/components/legal/{Disclaimer,Privacy,Terms,Trademarks,ThirdParty,
AiDisclosure}.astro` — EN and VI in the same file, so a change to one is
visibly a change to the other in review — wrapped by `LegalPage.astro`
(title, "Last updated", VI notice). Addresses come from
`src/lib/contacts.ts`. The drafts below are the approved texts (H6,
2026-07-28; the AI Disclosure 2026-07-30), kept as the record and
corrected here only where facts changed: the contact addresses (D27), the
Privacy Policy and Terms — which v1.1 rewrote and which are therefore
**summarised** below instead of quoted — the third-party page's new
sections and the AI Disclosure's model list. The shipped Disclaimer and
Trademarks also carry small v1.1 wording fixes the drafts do not; for exact
wording, read the component.

### 3a. Disclaimer — `/legal/disclaimer`

**EN.** SoftHarbor is an independent, non-commercial directory of desktop
software. (1) **No affiliation:** we are not affiliated with, endorsed by,
or sponsored by any listed developer; names and logos identify products
only (see Trademarks). (2) **No hosting:** we host no installers; all
download links lead to third-party sites we do not control. (3) **No
warranty on information:** listings — including pricing, license, platform
availability, and security status — are provided "as is" and may be
outdated or wrong; pricing models change without notice. (4) **Security
statuses are not guarantees:** "No known warnings — checked <date>" means
our checklist found nothing *on that date*; it is not an audit, a
certification, or a promise of safety. Software can be compromised after
our check. Always download from official sources, verify signatures or
checksums where offered, and use your own judgment. (5) **Your risk:**
installing third-party software is entirely at your own risk; to the
maximum extent permitted by law we accept no liability for damages arising
from software you obtain via links on this site. (6) **Reporting a
listing:** a dangerous one — a hijacked, look-alike or malicious download
link — goes privately to `security@poli0981.dev`, not to a public issue, so
the bad link is not spread further; outdated or wrong information goes to a
GitHub issue; a developer who wants their entry changed or removed writes
to `takedown@poli0981.dev`.

**VI.** SoftHarbor là trang tổng hợp phần mềm desktop độc lập, phi thương
mại. (1) **Không liên kết:** chúng tôi không liên kết, không được bảo trợ
hay tài trợ bởi bất kỳ nhà phát triển nào; tên và logo chỉ nhằm nhận diện
sản phẩm (xem Thương hiệu). (2) **Không lưu trữ:** chúng tôi không lưu trữ
tệp cài đặt; mọi liên kết tải về dẫn tới trang bên thứ ba ngoài tầm kiểm
soát của chúng tôi. (3) **Không bảo đảm thông tin:** thông tin — gồm giá,
giấy phép, nền tảng hỗ trợ, trạng thái bảo mật — được cung cấp "nguyên
trạng", có thể lỗi thời hoặc sai; mô hình giá có thể thay đổi bất kỳ lúc
nào. (4) **Trạng thái bảo mật không phải bảo chứng:** "Không có cảnh báo đã
biết — đã kiểm tra <ngày>" nghĩa là quy trình kiểm tra của chúng tôi không
phát hiện gì *tại ngày đó*; đây không phải kiểm định hay cam kết an toàn.
Phần mềm có thể bị xâm phạm sau thời điểm kiểm tra. Hãy luôn tải từ nguồn
chính thức, xác minh chữ ký/checksum nếu có, và tự cân nhắc. (5) **Rủi ro
của bạn:** việc cài đặt phần mềm bên thứ ba hoàn toàn thuộc rủi ro của bạn;
trong phạm vi tối đa pháp luật cho phép, chúng tôi không chịu trách nhiệm
cho thiệt hại phát sinh. (6) **Báo cáo một mục:** mục nguy hiểm — liên kết
tải về bị chiếm quyền, giả mạo hoặc độc hại — hãy báo riêng tới
`security@poli0981.dev`, đừng mở issue công khai, để liên kết xấu không bị
lan rộng thêm; thông tin lỗi thời hoặc sai hãy báo qua GitHub issue; nhà
phát triển muốn sửa hoặc gỡ mục của mình có thể viết tới
`takedown@poli0981.dev`.

### 3b. Privacy Policy — `/legal/privacy`

**Rewritten 2026-10-21 (v1.1) — summary of the shipped text; exact EN and
VI wording in `Privacy.astro`.** The v1.0 draft ("we collect nothing … no
analytics") stopped being true with D25/D26 and is not reproduced here
(git history has it). Section anchors are stable — the gate links
`#turnstile`:

- **Short version** — no accounts, no ads, no cookies, nothing sold or
  shared for advertising; two Cloudflare services see limited data —
  statistics that skip you under Global Privacy Control, and a bot check
  that runs only after you accept; your settings stay in your browser.
- **`#who`** — the operator: an individual developer, poli0981
  (SkullMute), in Vietnam, who decides how the little data described is
  handled; questions to `privacy@poli0981.dev`.
- **`#storage`** — localStorage `sh:legal`, `sh:human`, `sh:lang`,
  `sh:theme`, `sh:scrollbar`, `sh:motion`, never sent anywhere; a service
  worker stores the offline page, styles and fonts; no cookies (docs/09 §8).
- **`#analytics`** — Cloudflare Web Analytics: no cookies, nothing stored
  in the browser; reports page address, referrer, load timings and
  user-agent; Cloudflare derives a country and shows us totals only, never
  individual visits or IPs. Never runs under Global Privacy Control, nor
  on any host but softharbor.net. Basis: legitimate interest.
- **`#turnstile`** — after acceptance only, once; runs in a frame from
  challenges.cloudflare.com; the one-time token goes to `/api/verify`,
  which forwards it with the IP to Siteverify; requests are counted per IP
  (per /64 for IPv6) for one minute to prevent abuse; the endpoint logs only
  success and duration. A pass is remembered 48 h (`sh:human`); if the
  check cannot run the visitor is let in and it is retried after an hour.
  Basis: legitimate interest.
- **`#hosting`** — Cloudflare serves the site and the endpoint and
  processes connection data under its own policy; we see aggregate counts.
- **`#email`** — `@poli0981.dev` mail is delivered to a Google-hosted
  mailbox; used only to deal with what was written; deleted when no longer
  needed, or sooner on request.
- **`#bug-reports`** — "Report a bug" is a link to a prefilled GitHub issue
  form: **GitHub receives** the page URL, user-agent and recent error lines
  **as soon as the link is opened**; nothing is filed until the visitor
  submits it.
- **`#links`** — developers' sites have their own policies.
- **`#rights`** — Global Privacy Control turns statistics off; blocking
  challenges.cloudflare.com still lets you in; clearing site data removes
  everything stored; access, correction, deletion or objection via
  `privacy@poli0981.dev`; the right to complain to a data protection
  authority.
- **`#changes`** — a change moves the date and the gate asks everyone to
  accept the new version.

### 3c. Terms of Use — `/legal/terms`

**Revised 2026-10-21 (v1.1) — clause summary of the shipped text; exact EN
and VI wording in `Terms.astro`.** The approved v1.0 clauses (1)–(7) stand
in substance; v1.1 added the operator, the bot check and a
copyright-complaint procedure, and changed the contact. Shipped order:

1. **`#operator` — Who we are:** `https://softharbor.net` ("SoftHarbor") is
   a non-commercial project run by an individual developer, poli0981
   (SkullMute), in Vietnam — "we" or "the operator".
2. **Acceptance:** using the site means accepting these terms, the
   Disclaimer and the Privacy Policy; the consent dialog records acceptance
   in the browser, *then runs the automatic bot check the Privacy Policy
   describes*.
3. **The service:** an informational directory of links and metadata; no
   downloads hosted; availability not guaranteed; may change or stop.
4. **Acceptable use:** no scraping at abusive rates (use
   `/api/apps.json`), no attempts to disrupt the service **or to get past
   its bot check by automated means**, no misrepresentation of SoftHarbor
   as affiliated with listed vendors.
5. **Intellectual property:** code GPL-3.0-only; dataset CC BY-SA 4.0
   (LICENSE-DATA); third-party names and logos remain their owners'
   (Trademarks).
6. **`#copyright` — Copyright complaints:** email `dmca@poli0981.dev` with
   the work owned; the material and its address on the site; name and
   contact details; a good-faith statement that the use is not authorised;
   a statement that the notice is accurate and the sender owns the right or
   may act for its owner; a signature (a typed full name is enough). We
   remove or disable the material promptly and tell whoever added it, who
   may counter-notify to the same address. A developer wanting a listing or
   logo changed writes to `takedown@poli0981.dev` instead.
7. **No warranty / limitation of liability:** "as is"; to the maximum
   extent permitted by law the operator is not liable for damages from the
   service or third-party software reached through it.
8. **Changes:** material changes bump the version and re-show the consent
   dialog (Part 2 policy).
9. **Governing law:** Vietnam, without regard to conflict-of-law rules;
   an unenforceable provision leaves the rest standing.
10. **Contact:** `legal@poli0981.dev`.

### 3d. Trademarks — `/legal/trademarks`

**EN.** All product names, brands, and logos on SoftHarbor are trademarks
or registered trademarks of their respective owners. They are used solely
for **nominative identification** — to state truthfully which software an
entry describes — which does not imply affiliation, sponsorship, or
endorsement in either direction. Logo handling rules we hold ourselves to:
logos are shown unmodified (no recoloring beyond monochrome rendering of
vector marks, no distortion), at reasonable UI sizes, next to accurate
information, sourced from the Simple Icons set or the vendor's official
brand assets. "SoftHarbor" and the SoftHarbor wordmark identify this
project. **Takedown:** if you own a mark and want its use changed or
removed, email `takedown@poli0981.dev` or open a GitHub issue — we comply
promptly and remove the entry's logo (or the entry) while discussing.

**VI.** Mọi tên sản phẩm, thương hiệu và logo trên SoftHarbor là nhãn hiệu
hoặc nhãn hiệu đã đăng ký của chủ sở hữu tương ứng, chỉ được dùng nhằm
**nhận diện đúng sản phẩm** mà mục tương ứng mô tả — không hàm ý liên kết,
tài trợ hay chứng thực theo bất kỳ chiều nào. Nguyên tắc với logo: hiển thị
nguyên bản (không đổi màu ngoài việc render đơn sắc với logo vector, không
biến dạng), ở kích thước hợp lý, đi kèm thông tin chính xác, lấy từ bộ
Simple Icons hoặc bộ nhận diện chính thức của nhà phát triển. "SoftHarbor"
và wordmark SoftHarbor nhận diện dự án này. **Yêu cầu gỡ bỏ:** nếu bạn là
chủ sở hữu nhãn hiệu và muốn thay đổi/gỡ việc sử dụng, hãy email
`takedown@poli0981.dev` hoặc mở GitHub issue — chúng tôi sẽ xử lý nhanh chóng và
tạm gỡ logo (hoặc mục liên quan) trong quá trình trao đổi.

### 3e. Third-Party Notices — `/legal/third-party`

**EN intro.** SoftHarbor is built with open-source software. Runtime and
asset dependencies and their licenses:

| Component | License | Note |
|---|---|---|
| Astro, Svelte, Tailwind CSS, MiniSearch, nanostores, Workbox (via @vite-pwa) | MIT | build/runtime |
| Lucide icons | ISC | UI icons |
| Simple Icons | CC0-1.0 | **Caveat shown verbatim:** the icons are CC0, but the brands they depict remain trademarks of their owners; see /legal/trademarks |
| Bricolage Grotesque · Be Vietnam Pro · IBM Plex Mono | SIL OFL 1.1 | self-hosted via Fontsource |

Since v1.1 the page has two more sections. **`#services`** — the services
that receive requests while the site is used, each with a link to its own
privacy policy: Cloudflare (hosting and delivery, the `/api/verify`
endpoint, Web Analytics, Turnstile) and GitHub (the repository, issues, the
prefilled bug-report form). **`#packages` — "Every package in this
build"**: each `dependencies` entry of `package.json` with its *installed*
version and the license it declares, generated at **build time** by
`src/lib/licenses.ts` (server-only, read from `node_modules`), so it cannot
fall behind the code. (v1.0 promised "a full machine-generated dependency
list" and shipped none; `pnpm licenses list` was never wired.) Licensing
questions: `copyright@poli0981.dev`.
**VI intro.** SoftHarbor được xây dựng trên phần mềm mã nguồn mở. Các thành
phần và giấy phép tương ứng: (same table; the services and package
sections follow, in Vietnamese).

### 3f. AI Disclosure — `/legal/ai-disclosure`

Added 2026-07-30. **Provenance, not disclaimer.** The site asks a reader to
trust a set of links and a dated security note; that request is worth less if
they cannot see how the list was assembled. It also backs Part 1: the dataset
can only carry CC BY-SA 4.0 because the summaries are the project's own words
(hard rule 8), and saying so plainly is stronger than leaving it implied.

Must name **each model whose work lands, its version identifier, and its
developer** — currently Claude models by Anthropic, used through Claude
Code: **Claude Opus 5** (`claude-opus-5`) for the site and catalogue
through v1.0, and **Claude Opus 5.5** (`claude-opus-5-5`) for the v1.1 and
v1.2 work of October 2026; no other AI system contributed. Every claim on the page
must stay literally true — update it when a process changes (two false
claims were corrected on 2026-10-21).

| Area | Position (as shipped, v1.2) |
|---|---|
| Source code | AI-assisted, reviewed and run by the maintainer; the same automated gates as any change — lint, type-check, unit and browser tests, schema validation, EN/VI parity, a build, a CSP guard |
| Tests | Drafted with AI assistance, reviewed against the behaviour they describe; run on every change, and nothing merges while one fails |
| Finding the software | Candidate list AI-assisted; **inclusion is a human decision** against docs/00 §3; links machine-checked per PR (changed entries) and weekly (whole catalogue), with "forbidden"/"too many requests" counted as reachable |
| Summaries | Written from scratch in both locales, never pasted; VI reviewed by a native speaker, not machine-translated |
| Security status | **Not AI-decided** — "no known warnings" only after the maintainer ran docs/09 §6; from then on `vt-recheck.yml` re-scans every download page on VirusTotal at least every 90 days and moves the date (a fixed rule, not a model: any warning drops the entry to "unverified" and opens an issue; only the maintainer marks clean, flags or removes). The scan is linked from the app page; where a link changed after its scan, the linked scan is of the earlier link until the next re-check. Updated 2026-10-23 (`LEGAL_UPDATED.aiDisclosure`; not an accepted document, so `LEGAL_VERSION` and the gate are unchanged) |

Closes with the limits being unchanged: AI assistance is neither a warranty
nor an excuse, and a mistake here belongs to the maintainer, not a tool.

**Not part of the accepted set.** The legal gate asks acceptance of the
Disclaimer, Terms and Privacy only; this page is informational and is reached
from the footer. It is still gate-exempt like every other `/legal/*` route.

## Part 4 — Review checklist for Kokone (H6)

H6 approved the drafts on 2026-07-28. The 2026-10-21 rewrite (Privacy,
Terms, contacts, AI Disclosure) re-opens these items — sign-off on it:
⚠ verify.

- [ ] Confirm the D27 addresses are live and a test mail to each purpose
      address arrives (the old `contact@softharbor.net` / Email Routing
      plan of H5 is superseded — docs/16 §6).
- [ ] Confirm governing-law choice (Vietnam) in Terms (clause 9 since
      v1.1; §7 in the v1.0 draft).
- [ ] Confirm the no-decline-button gate wording is acceptable, and the
      step-2 wording about Turnstile.
- [ ] Confirm the Privacy Policy's legitimate-interest basis for Web
      Analytics and Turnstile, and its rights section.
- [ ] Confirm the copyright-complaint procedure (Terms `#copyright`) and
      the operator clause (`#operator`).
- [ ] Read both language versions aloud once — tone: calm, plain, no
      legalese beyond necessity.
- [ ] Confirm comfort with C3 free-tier ruling as written in Disclaimer
      context (pricing can change → covered by 3a(3)).
- [ ] `LEGAL_VERSION` follows the Part 2 policy (2026-10-21 as of v1.1); a
      later material change to Disclaimer, Terms or Privacy bumps it, and
      `legal.test.ts` fails if one is dated after it.
- [ ] Optional (recommended eventually): a qualified local review of Terms
      + Disclaimer + Privacy. These texts are diligent but are not legal
      advice.
