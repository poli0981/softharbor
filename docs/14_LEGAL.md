# 14 — Legal (licensing · gate · bilingual drafts)

> ⚠️ These drafts are templates prepared by the project, **not legal
> advice**. Kokone reviews and approves before first public deploy (H6).
> Since v1.1 the site URL is final (`https://softharbor.net`) and the
> contact address is `contact@softharbor.net` — it must be live via Email
> Routing (docs/16 §6, H5) before these pages publish. At implementation
> time each draft below is split into its own page under `/legal/*` (EN)
> and `/vi/legal/*` (VI). English is canonical (docs/07 §8).
> All drafts: **Last updated: 2026-07-20**.

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
```

Provenance rule enforcing licensability: summaries are written from scratch
(hard rule 8) — never copied from vendors or Wikipedia — so the project can
actually grant CC BY-SA on them.

## Part 2 — Legal gate specification

**Purpose:** ensure every user has seen the disclaimer (T1) before using
the directory, in the CommandForge tradition, adapted to the web.

| Aspect | Spec |
|---|---|
| Trigger | First route render when `localStorage['sh:legal'] !== LEGAL_VERSION` (docs/05 §A7) |
| Component | `ShLegalGate.svelte`, `client:load`, `transition:persist`, native `<dialog>` `showModal()` |
| Exempt routes | `/legal/**`, `/vi/legal/**`, `/404`, `/offline`, `/errors/*` — so the gate can link to the very documents it asks users to accept, and error/offline states never dead-lock |
| Content | Locale-matched summary (below) + links to Disclaimer/Privacy/Terms + single accept button. No decline button: the gate itself explains that leaving the site is the alternative |
| Interaction | Focus trapped by `showModal()`; **Esc intercepted** (`cancel` event `preventDefault`) pre-accept; page content behind is rendered but `inert` |
| Crawlers/SEO | Content renders underneath normally (dialog is an overlay, no cloaking, no JS-gated content); bots don't execute acceptance and don't need to |
| Persistence | Accept ⇒ `sh:legal = LEGAL_VERSION`. Version bump (any legal doc change) re-opens for everyone. localStorage unavailable ⇒ fail open per session (in-memory accept) |
| Copy EN | **Before you continue** — SoftHarbor is a link directory. We don't host downloads, and we can't guarantee third-party software. Statuses like "no known warnings" reflect checks on the date shown — verify anything you install. By continuing you accept the [Disclaimer], [Terms of Use] and [Privacy Policy]. → **I understand and accept** |
| Copy VI | **Trước khi tiếp tục** — SoftHarbor là trang tổng hợp liên kết. Chúng tôi không lưu trữ tệp cài đặt và không thể bảo đảm cho phần mềm bên thứ ba. Trạng thái như "không có cảnh báo đã biết" chỉ phản ánh việc kiểm tra tại ngày ghi kèm — hãy tự xác minh trước khi cài đặt. Khi tiếp tục, bạn chấp nhận [Tuyên bố miễn trừ], [Điều khoản sử dụng] và [Chính sách quyền riêng tư]. → **Tôi hiểu và chấp nhận** |

## Part 3 — Draft legal documents (EN canonical · VI courtesy)

Every VI page carries: *"Bản tiếng Việt chỉ nhằm mục đích tham khảo; nếu có
khác biệt, bản tiếng Anh được ưu tiên áp dụng."*

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
from software you obtain via links on this site. (6) Report dangerous or
incorrect listings: GitHub issues or `contact@softharbor.net`.

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
cho thiệt hại phát sinh. (6) Báo cáo mục nguy hiểm/sai: GitHub issues hoặc
`contact@softharbor.net`.

### 3b. Privacy Policy — `/legal/privacy`

**EN.** Short version: we collect nothing. (1) **No accounts, no forms, no
analytics, no ads, no cookies.** (2) **Local preferences only:** language,
theme, and legal-acceptance version are stored in your browser's
localStorage (`sh:lang`, `sh:theme`, `sh:legal`) and never transmitted;
clearing site data removes them. A service worker caches a small offline
page. (3) **Infrastructure:** the site is served by Cloudflare, which
processes connection data (such as IP addresses) as a network provider
under its own privacy policy. We do not receive or store this data;
aggregate request counts are visible to us in Cloudflare's dashboard.
(4) **Bug reports:** the "Report a bug" button opens a **prefilled GitHub
issue in your browser** containing the page URL, your browser/OS string,
and recent console error lines from this site. Nothing is sent until you
review and submit it on GitHub, under GitHub's terms and privacy policy.
(5) **Third-party links** lead to sites with their own policies.
(6) **Changes** to this policy bump the version date and re-show the
consent gate. Contact: `contact@softharbor.net`.

**VI.** Phiên bản ngắn gọn: chúng tôi không thu thập gì. (1) **Không tài
khoản, không biểu mẫu, không analytics, không quảng cáo, không cookie.**
(2) **Chỉ lưu tuỳ chọn cục bộ:** ngôn ngữ, giao diện sáng/tối và phiên bản
điều khoản đã chấp nhận được lưu trong localStorage của trình duyệt
(`sh:lang`, `sh:theme`, `sh:legal`), không bao giờ được truyền đi; xoá dữ
liệu trang sẽ xoá chúng. Service worker lưu một trang offline nhỏ. (3) **Hạ
tầng:** trang được phục vụ bởi Cloudflare — đơn vị xử lý dữ liệu kết nối
(như địa chỉ IP) theo chính sách riêng của họ với vai trò nhà cung cấp hạ
tầng. Chúng tôi không nhận hay lưu dữ liệu này; chỉ thấy số liệu truy cập
tổng hợp trong bảng điều khiển Cloudflare. (4) **Báo lỗi:** nút "Report a
bug" mở một **issue GitHub được điền sẵn trong trình duyệt của bạn** gồm
URL trang, chuỗi trình duyệt/hệ điều hành và các dòng lỗi console gần đây
của trang này. Không có gì được gửi đi cho tới khi bạn xem lại và tự đăng
trên GitHub, theo điều khoản và chính sách của GitHub. (5) **Liên kết bên
thứ ba** có chính sách riêng. (6) **Thay đổi** chính sách sẽ cập nhật ngày
phiên bản và hiển thị lại hộp thoại chấp nhận. Liên hệ: `contact@softharbor.net`.

### 3c. Terms of Use — `/legal/terms`

**EN.** (1) **Acceptance:** using `https://softharbor.net` means you accept these
terms, the Disclaimer, and the Privacy Policy; the consent dialog records
acceptance in your browser. (2) **The service:** an informational directory
of links and metadata; no downloads are hosted; availability is not
guaranteed and the service may change or stop at any time. (3) **Acceptable
use:** no scraping at abusive rates (the public dataset at `/api/apps.json`
exists — use it), no attempts to disrupt the service, no misrepresentation
of SoftHarbor as affiliated with listed vendors. (4) **Intellectual
property:** site code is GPL-3.0-only; the dataset is CC BY-SA 4.0 (see
LICENSE-DATA); third-party names/logos remain their owners' property.
(5) **No warranty / limitation of liability:** the service is provided "as
is" without warranties of any kind; to the maximum extent permitted by law,
the operator is not liable for any damages arising from use of the service
or of third-party software reached through it. (6) **Changes:** material
changes bump the version and re-show the consent dialog. (7) **Governing
law:** the laws of Vietnam, without regard to conflict-of-law rules; if a
provision is unenforceable, the remainder stands. Contact:
`contact@softharbor.net`.

**VI.** (1) **Chấp nhận:** việc sử dụng `https://softharbor.net` đồng nghĩa bạn chấp
nhận các điều khoản này, Tuyên bố miễn trừ và Chính sách quyền riêng tư;
hộp thoại đồng ý ghi nhận việc chấp nhận trong trình duyệt của bạn.
(2) **Dịch vụ:** trang thông tin tổng hợp liên kết và siêu dữ liệu; không
lưu trữ tệp tải về; không bảo đảm tính khả dụng; dịch vụ có thể thay đổi
hoặc dừng bất kỳ lúc nào. (3) **Sử dụng hợp lệ:** không scrape với tần suất
gây hại (đã có bộ dữ liệu công khai tại `/api/apps.json` — hãy dùng nó),
không phá hoại dịch vụ, không mạo nhận SoftHarbor liên kết với các nhà phát
triển được liệt kê. (4) **Sở hữu trí tuệ:** mã nguồn theo GPL-3.0-only; bộ
dữ liệu theo CC BY-SA 4.0 (xem LICENSE-DATA); tên/logo bên thứ ba thuộc chủ
sở hữu tương ứng. (5) **Không bảo đảm / giới hạn trách nhiệm:** dịch vụ
cung cấp "nguyên trạng" không kèm bất kỳ bảo đảm nào; trong phạm vi tối đa
pháp luật cho phép, người vận hành không chịu trách nhiệm cho thiệt hại
phát sinh từ việc dùng dịch vụ hoặc phần mềm bên thứ ba truy cập qua dịch
vụ. (6) **Thay đổi:** thay đổi trọng yếu sẽ nâng phiên bản và hiển thị lại
hộp thoại đồng ý. (7) **Luật áp dụng:** pháp luật Việt Nam; nếu một điều
khoản vô hiệu, các điều khoản còn lại vẫn giữ hiệu lực. Liên hệ:
`contact@softharbor.net`.

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
removed, email `contact@softharbor.net` or open a GitHub issue — we comply
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
`contact@softharbor.net` hoặc mở GitHub issue — chúng tôi sẽ xử lý nhanh chóng và
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

Full machine-generated dependency list ships as `/legal/third-party`
appendix regenerated each release (`pnpm licenses list` → build step).
**VI intro.** SoftHarbor được xây dựng trên phần mềm mã nguồn mở; bảng trên
liệt kê thành phần và giấy phép; danh sách đầy đủ được tạo tự động mỗi bản
phát hành.

### 3f. AI Disclosure — `/legal/ai-disclosure`

Added 2026-07-30. **Provenance, not disclaimer.** The site asks a reader to
trust a set of links and a dated security note; that request is worth less if
they cannot see how the list was assembled. It also backs Part 1: the dataset
can only carry CC BY-SA 4.0 because the summaries are the project's own words
(hard rule 8), and saying so plainly is stronger than leaving it implied.

Must name the **model, its version identifier, and its developer** — currently
Claude Opus 5 (`claude-opus-5`), Anthropic, used through Claude Code.

| Area | Position |
|---|---|
| Source code | AI-assisted, maintainer-reviewed, same automated gates as any change |
| Tests | AI-drafted, kept only once seen to fail on the bug they claim to cover |
| Finding the software | Candidate list AI-assisted; **inclusion is a human decision** against docs/00 §3, links machine-checked per PR and weekly |
| Summaries | Written from scratch in both locales, never pasted; VI reviewed by a native speaker, not machine-translated |
| Security status | **Not AI-decided** — maintainer runs docs/09 §6, and the scan is linked from the app page |

Closes with the limits being unchanged: AI assistance is neither a warranty
nor an excuse, and a mistake here belongs to the maintainer, not a tool.

**Not part of the accepted set.** The legal gate asks acceptance of the
Disclaimer, Terms and Privacy only; this page is informational and is reached
from the footer. It is still gate-exempt like every other `/legal/*` route.

## Part 4 — Review checklist for Kokone (H6)

- [ ] Confirm `contact@softharbor.net` is live (Email Routing, docs/16 §6)
      and a test mail arrives before these pages publish (H5).
- [ ] Confirm governing-law choice (Vietnam) in Terms §7.
- [ ] Confirm the no-decline-button gate wording is acceptable.
- [ ] Read both language versions aloud once — tone: calm, plain, no
      legalese beyond necessity.
- [ ] Confirm comfort with C3 free-tier ruling as written in Disclaimer
      context (pricing can change → covered by 3a(3)).
- [ ] Set `LEGAL_VERSION` to the approval date; if drafts change later,
      bump it (gate re-shows).
- [ ] Optional (recommended eventually): a qualified local review of Terms
      + Disclaimer. These templates are diligent but are not legal advice.
