# 11 — Testing Strategy

## 1. Shape

```
        ▲  manual: launch checklist (docs/13 §2) — a11y, visual VI diacritics,
        │          real-device offline, screen readers
        │  build-as-integration-test: astro build + validate-data + parity
        │          + lychee (offline mode) over dist/ internal links
        │  unit (vitest): src/lib/** — the only place real logic lives
        ▼
```

No Playwright in v1 (decision: the site has six islands and no forms;
build + units + the checklist cover it). Revisit post-v1 if islands grow.

**Island tests run in happy-dom** (added in S4). `vitest.config.ts` declares
two projects: `unit` (node, `src/lib/**`) and `islands` (happy-dom,
`src/components/**`), the latter with `resolve.conditions: ['browser']` or
Svelte resolves to its SSR build and `mount()` throws. This is not a
substitute for Playwright and does not pretend to be: it asserts island
*state machines* — open/close, keyboard interception, lifecycle across
simulated `astro:after-swap` — never layout, top-layer stacking, or visual
appearance. Those stay on the manual checklist (docs/13 §2).

## 2. Unit targets (`vitest`)

| Module | Cases |
|---|---|
| `normalize.ts` | full vector table docs/05 §A1 incl. NFC vs NFD inputs, `đ/Đ`, whitespace collapse, empty string |
| `search.ts` | index round-trip (`toJSON`/`loadJSON`); `trinh duyet` → browsers; prefix (`fire` → Firefox); fuzzy (see note); AND semantics; empty query behavior; `tags` array flattened by `extractField` |
| `stores.ts` + filter fn | OR-within/AND-across facets; clear-all; sort orders incl. VN names |
| `issueUrl.ts` | budget respected; truncation drops oldest lines first; empty buffer; URL-encoding of `#`/`&`/newlines |
| feed builder | deterministic output; top-50 cutoff; stable guid |
| `i18n/index.ts` | var substitution; missing-key fallback; parity assertion (en/vi key sets equal — the same check CI runs) |
| `legal.ts` | version equality (stale **and** newer both re-open); garbage value; route exemptions incl. near-miss paths (`/legalish`, `/offlinely` must stay gated); hostile localStorage fails open per session |
| `validate-data.mjs` | fixture-based: dup slug, dup name (diacritic-insensitive), unknown category, http URL, flagged-in-main-tree each produce the right error row |

**Fuzzy vectors — resolved by S2 (2026-07-27), decision D22.** The old
`gmip` → GIMP case is a *transposition* (2 edits on 4 characters) and needs
`fuzzy ≥ 0.375`; measurement showed that setting also stops the correctly
spelled `gimp` from being an exact match (table in docs/05 §A2). It was
**retired** in favour of `fuzzy = 0.25` plus honest vectors: `gimo` → GIMP
(1 edit) and `fierfox` → Firefox (transposition in a 7-char term). The suite
also pins the *precision* side — `gimp` → only GIMP, `archiver` → only 7-Zip
— so a future fuzzy miss cannot be "fixed" by raising the constant.

Coverage gates: `src/lib/**` ≥ 90 % lines (normalize/issueUrl at 100 %);
no gate on `.astro/.svelte` (rendered output is checked by build + manual).

## 3. P0 spikes — run before feature work (phase P1)

> Pattern carried from FrameLedger/QuoteAtlas: prove the risky assumptions
> on day one, while changing course is still free.

### S1 — Toolchain reality check (Astro 7 + Rolldown)
- **Goal:** the *entire* integration set compiles and dev-serves together:
  `@astrojs/svelte` (Svelte 5), `@tailwindcss/vite` 4.3, `unplugin-icons`,
  `@vite-pwa/astro`, `@astrojs/sitemap`, `@astrojs/rss`, Vitest.
- **Method:** scaffold, add all, build a page using each (an icon, a styled
  Svelte island, PWA manifest emit, one rss/sitemap route), `pnpm build`,
  `pnpm test` on a trivial spec. Also settle the dependency build-script
  policy (docs/09 §7).
- **Exit:** clean build + dev HMR + SW emitted.
- **Fallback (pre-approved):** pin `astro@6.5.x`; record in decision log.

**S1 result — PASSED 2026-07-27.** Astro 7.1.3 · Svelte 5.56.8 · Tailwind
4.3.3 · MiniSearch 7.2.0 · nanostores 1.4.1 · Vitest 4.1.10 all build and
type-check together; the Astro 6.5 fallback was **not** needed. Four findings
changed the spec:

1. `@nanostores/svelte` does not exist (D15 amended, docs/01 §2).
2. Island hydration emits inline scripts ⇒ D18 unachievable, replaced by the
   split CSP of D20 (docs/09 §4). ClientRouter itself is external, so View
   Transitions are safe.
3. TypeScript 7 breaks `astro check` ⇒ hold at 6.x (D21).
4. `ignore-scripts=true` does **not** "break nothing" — it stops the build
   outright, and pnpm ≥ 10 supersedes it anyway (docs/09 §7).

Still open in S1, and it needs a deploy (H2/H3), not code: the
`trailingSlash: 'never'` × `html_handling` check. Run the two `curl` probes in
docs/16 §10 the moment the first deploy lands.

**S1 additionally owns two questions this suite could not settle on paper.
Neither is optional — both change shipped behavior:**

1. **Does `script-src 'self'` survive `<ClientRouter />`?** (docs/09 §4, D18.)
   Serve the built `dist/` with the real `_headers` CSP and navigate. If
   ClientRouter emits an inline bootstrap, the console shows a CSP violation.
   *Exit:* zero CSP violations with zero inline scripts.
   *If it fails:* drop `<ClientRouter />` — and with it View Transitions
   (docs/02 §6, docs/06 §7). Log the branch taken. Do **not** resolve this by
   adding hashes back without re-reading docs/09 §4.
2. **`trailingSlash: 'never'` × Workers `html_handling`.** (docs/02 §4/§7.)
   Deploy and `curl -sI` **both** `/apps/7-zip` and `/apps/7-zip/`.
   *Exit:* exactly one canonical URL returns 200 and the other 301s to it —
   no redirect loop, no two live URLs for one page. Pin whichever
   `html_handling` value produces that into `wrangler.jsonc`.

### S2 — Vietnamese search correctness
- **Goal:** normalizer + MiniSearch behave on real Vietnamese.
- **Method:** run the §2 vector table; add paste-input cases in **both** NFC
  and NFD encodings (generate with `String.normalize`), plus mixed-language
  queries against a 20-app fixture set.
- **Exit:** all green; `trinh duyet`, `trình duyệt`, `TRINH DUYET`,
  decomposed `trình duyệt` return identical result sets.

### S3 — GitHub Issue-Forms prefill limit
- **Goal:** find the real max URL length github.com accepts with form-field
  prefill, and confirm params map to field ids.
- **Method:** hand-craft URLs against a scratch repo's `bug_report.yml`,
  binary-search length until GitHub truncates/rejects; test `\n` and unicode
  in `console-output`.
- **Exit:** empirical limit documented; `BUDGET` in `issueUrl.ts` set to
  ~80 % of it; prefill lands in the correct fields.

### S4 — Legal gate × View Transitions
- **Goal:** gate never re-flashes across ClientRouter navigations and truly
  blocks interaction pre-accept.
- **Method:** prototype `ShLegalGate` with `transition:persist`; navigate
  grid → detail → back pre-accept and post-accept; verify focus trap, Esc
  interception, exempt routes, `sh:legal` versioning incl. downgrade value.
- **Exit:** zero flash, zero interaction leaks, exemptions correct.

**S4 result — PASSED 2026-07-27, with two design bugs caught.** The gate is
`ShLegalGate.svelte` (`client:load` + `transition:persist`); 32 automated
assertions cover it (`legal.test.ts` + `ShLegalGate.test.ts`).

1. **A persisted `<dialog>` can come out of a document swap with `open`
   cleared.** `transition:persist` preserves the DOM node, not the top-layer
   state — so the gate would have silently stopped blocking after the first
   navigation. Fixed by re-asserting `showModal()` in an `astro:after-swap`
   handler; the test closes the dialog behind the component's back and swaps,
   to prove the re-assert is load-bearing.
2. **A persisted island keeps the `locale` prop it first rendered with.**
   Navigating `/apps` → `/vi/apps` left English gate copy on a Vietnamese
   page. Fixed by deriving locale from `location.pathname` on every swap
   rather than trusting the prop.

Also verified: Esc intercepted pre-accept (`cancel` prevented); acceptance
persists and never re-flashes across swaps; exempt routes never gate, and
navigation *onto* and *off* an exempt route updates correctly; a stale **or
newer** stored version re-opens (equality, not ordering); hostile localStorage
fails open for the session instead of dead-locking.

**Not covered by the automated pass** — these stay manual launch-checklist
items (docs/13 §2), because the environment has no browser: real top-layer
stacking/backdrop, actual focus trapping by the UA, and "no visual flash".
The tests assert the *state machine* that drives those, not their rendering.

### S5 — PWA offline on the real origin
- **Goal:** offline fallback works where users are: `softharbor.net`.
- **Method:** deploy the spike build (a versioned preview URL is fine for
  early iterations; the final pass runs on `softharbor.net` once H2's zone
  is live — docs/08 Part D); airplane-mode navigation on desktop + Android
  Chrome; verify `/offline` renders, fonts present, SW `autoUpdate` picks
  up a redeploy without hard refresh.
- **Exit:** fallback fires on both devices on the production origin;
  update flow clean.

## 4. Continuous wiring

CI order (docs/12 §2): install → lint → test → validate:data → build →
lychee(dist, internal) — failure anywhere blocks merge. The weekly external
link check and CodeQL run on schedule, not per-PR.
