<!-- Title: Conventional Commits, lowercase, imperative — it becomes the squash
     commit and the changelog line (CONTRIBUTING.md). One logical change per PR;
     for data, one app per PR unless a decision-log entry says otherwise. -->

## What and why

<!-- One or two sentences. Link the issue: "Closes #123". -->

## Checks

- [ ] `pnpm lint && pnpm check && pnpm coverage && pnpm build && pnpm knip && pnpm e2e` pass locally
- [ ] Docs that describe the changed behaviour are updated (`docs/`, README, CHANGELOG for
      visitor-facing changes)
- [ ] Every new UI string exists in both `src/i18n/en.json` and `src/i18n/vi.json`

## Accessibility ([ACCESSIBILITY.md](../ACCESSIBILITY.md))

Tick what applies, or write "no UI change".

- [ ] Keyboard only: every control reachable in a sensible order, focus always visible,
      no traps, Esc closes what it opened
- [ ] Names and states: each control's accessible name matches its visible label;
      expanded / selected / checked states are announced
- [ ] Screen-reader spot check (Narrator, NVDA or VoiceOver) for new or changed components
- [ ] Nothing by colour alone; contrast holds in light and dark; forced colours still
      show the state
- [ ] 200 % zoom and 320 px width: nothing cut off, no sideways scroll outside tables
- [ ] Motion respects reduced-motion (system and the display menu)

## Data PRs only

- [ ] Checked against the inclusion criteria (docs/00 §3) and the vetting checklist
      (docs/09 §6)
- [ ] Summaries written from scratch in English **and** Vietnamese
- [ ] New entries start `unverified` with `evidence: null`; only the maintainer moves one
      to `clean`
- [ ] Links are the developer's own domain or official repository — no portals, no
      tracking parameters
