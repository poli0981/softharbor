# Contributing

SoftHarbor is a directory of desktop software that is free or buy-once, and
its whole value is that a reader can trust the links and the dates on it. That
makes contributions here mostly a question of **evidence**, not effort.

By contributing you agree your work is licensed as the repository is: code
under **GPL-3.0-only**, dataset entries under **CC BY-SA 4.0**.

- Code of Conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Security vulnerabilities: [SECURITY.md](SECURITY.md) — **never** a public issue
- Contact: **contact@softharbor.net**

## Suggesting an app

Open an **App request** issue. Do not open a pull request for a new app before
the request is accepted — the answer is a curation judgement, and a rejected PR
wastes more of your time than a rejected issue.

An app is listable only when all of these hold ([docs/00 §3](docs/00_PROJECT_OVERVIEW.md)):

- Desktop software for Windows, macOS and/or Linux
- **Free, free + optional one-time purchase, or one-time purchase.** Never
  subscription-only. A free tier counts only if it serves the app's core
  purpose forever — not a trial, not a crippled demo
- Homepage and download page on the **developer's own domain or official
  repository**. Download portals and mirrors are not acceptable, ever
- Maintained, or finished and stable. Not abandonware with open vulnerabilities
- No bundled adware in the official installer; nothing piracy-adjacent

## Reporting a bug

Use the **Bug report** form, or the "Report a bug" button on any app page —
it pre-fills the details. Bugs are about _this site_. We cannot help with the
software we link to; take that to its own developer.

## Changing code or data

1. Branch from `main`: `data/add-<slug>`, `fix/<thing>`, `docs/<thing>`.
2. **One logical change per PR.** For data, that means **one app per PR**.
3. Conventional Commits, lowercase, imperative — `feat:`, `fix:`, `data:`,
   `docs:`, `chore:`, `ci:`, `refactor:`, `test:`. The squash title becomes the
   changelog entry, so it has to stand alone.
4. Run every gate before pushing. CI runs the same ones and they are not
   advisory:

```bash
pnpm lint && pnpm i18n:check && pnpm validate:data && pnpm test && pnpm check && pnpm build && pnpm check:styles && pnpm check:sw && pnpm knip
```

`check:styles` and `check:sw` inspect `dist/`, so they must run **after**
`build`.

Data lives in `src/data/apps/<slug>.json`, one file per app, validated by the
Zod schema in `src/content.config.ts`. Summaries are written **from scratch**
in both English and Vietnamese — that is what lets the dataset carry CC BY-SA
at all. Vietnamese is reviewed by a native speaker; machine translation is not
accepted.

If you are unsure whether something is wanted, open a discussion first. A
short question costs everyone less than a large rejected PR.

## Closed without discussion

The list below is not about being difficult. A directory people rely on for
download links is a natural target, and reviewing in good faith takes time that
has to come from somewhere. These get closed on sight, and the account may be
blocked:

**Malicious or deceptive**

- **Code that appears to plant anything malicious.** If CodeQL and Dependabot
  find nothing but the change still looks wrong, the maintainer reviews it by
  hand and takes as long as that needs. Confirmed — **permanent ban, no
  exceptions.**
- **Invisible or confusable characters** — zero-width joiners, bidirectional
  overrides, homoglyphs. In source they hide behaviour that reading cannot
  catch; in a URL they make a hostile domain look like the real one. On a links
  directory this is the single highest-value attack, so it is treated as one.
- **Links from unclear sources.** Every link must be the developer's own domain
  or official repository. Shorteners, redirectors, portals, mirrors, re-uploads
  and "I packaged it myself" builds are all refused.
- **Affiliate, referral or tracking parameters** on any link.
- **Binaries or archives attached to an issue or PR.** This project hosts no
  files and reviews no opaque ones.
- **A `security.status` of `clean` without evidence.** The status is only ever
  as good as the scan permalink behind it.
- **Fabricated or edited screenshots, logs or scan results.**

**Wasting review**

- **Not getting to the point.** Say what changed and why. No "Good morning,
  what a beautiful day…" preamble, no restating the issue back at us, no
  filler. Terse is welcome; padded is not.
- **Text that reads as unedited AI output** — confident, generic, and wrong in
  ways a human who tested it would have caught. Using AI is fine; shipping its
  output unread is not. This project discloses its own AI use at
  [/legal/ai-disclosure](https://softharbor.net/legal/ai-disclosure), and holds
  contributions to the same standard it holds itself.
- **Drive-by or automated PRs** — whitespace, reformatting, badge additions,
  dependency bumps Renovate already owns, or bulk submissions for contribution
  counts.
- **Vendor marketing copy or encyclopedia text** pasted as a summary. It breaks
  the licence provenance the dataset depends on.
- **Weakening a gate to make CI pass** — relaxing the CSP, `--no-verify`, an
  `eslint-disable` to silence a rule rather than fix it, deleting or skipping a
  failing test. If a gate is wrong, argue that in an issue and change it
  deliberately.
- **Hand-edited generated output** — anything in `dist/`, or a lockfile edited
  without the corresponding manifest change.
- **Reopening a settled decision with no new evidence.** The reasoning lives in
  the decision log ([docs/15 §4](docs/15_ROADMAP.md)); if it is wrong, bring
  the thing that makes it wrong.
- **Subscription-only software**, resubmitted after being told. The rule is not
  negotiable and re-litigating it is not a contribution.

**Conduct**

- Anything contrary to the
  [GitHub Acceptable Use Policies](https://docs.github.com/site-policy/acceptable-use-policies/github-acceptable-use-policies)
  or our [Code of Conduct](CODE_OF_CONDUCT.md) — harassment, slurs, spam,
  impersonation, or pressure of any kind.

If your contribution is closed and you believe it was misread, reply once with
the specific point. That will be read.
