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

## 2. Unit targets (`vitest`)

| Module | Cases |
|---|---|
| `normalize.ts` | full vector table docs/05 §A1 incl. NFC vs NFD inputs, `đ/Đ`, whitespace collapse, empty string |
| `search.ts` | index round-trip (`toJSON`/`loadJSON`); `trinh duyet` → browsers; prefix (`fire` → Firefox); fuzzy (see note); AND semantics; empty query behavior; `tags` array flattened by `extractField` |
| `stores.ts` + filter fn | OR-within/AND-across facets; clear-all; sort orders incl. VN names |
| `issueUrl.ts` | budget respected; truncation drops oldest lines first; empty buffer; URL-encoding of `#`/`&`/newlines |
| feed builder | deterministic output; top-50 cutoff; stable guid |
| `i18n/index.ts` | var substitution; missing-key fallback; parity assertion (en/vi key sets equal — the same check CI runs) |
| `validate-data.mjs` | fixture-based: dup slug, dup name (diacritic-insensitive), unknown category, http URL, flagged-in-main-tree each produce the right error row |

**Fuzzy vector note.** The old `gmip` → GIMP case is a *transposition*
(Levenshtein distance 2) and cannot pass at `fuzzy: 0.15`, which allows about
one edit on a 4-character term. S2 settles this: either raise the constant
(≈ `0.3`) or use a real one-edit typo such as `gimo` → GIMP. Whichever is
chosen, the value in docs/05 §A2 and the vector here must be updated together.

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
  `pnpm test` on a trivial spec. Also confirm `ignore-scripts=true` breaks
  nothing.
- **Exit:** clean build + dev HMR + SW emitted.
- **Fallback (pre-approved):** pin `astro@6.5.x`; record in decision log.

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
