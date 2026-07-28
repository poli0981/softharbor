// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/05 §A6 — prefilled GitHub issue URL.
//
// Query params must match the field `id`s in
// .github/ISSUE_TEMPLATE/bug_report.yml. Renaming an id is a breaking change
// to already-shipped clients (docs/12 §7).

const REPO = 'https://github.com/poli0981/softharbor';

/**
 * Total-URL budget in characters.
 *
 * Measured against github.com in spike S3 (2026-07-27), two probes per length:
 *
 *   ≤ 6660  → 302, clean
 *   7160-7960 → 500 Internal Server Error
 *   ~8160   → connection reset
 *   ≥ 8360  → 414 URI Too Long
 *
 * Note the shape: GitHub does not degrade gracefully into 414. There is a
 * ~1.3 KB band where it simply 500s, and a user only ever meets it at the
 * worst moment — the click that was meant to report a bug. So the budget sits
 * ~25 % below the first observed failure rather than at the 80 % of the hard
 * limit docs/05 §A6 originally assumed; 80 % of the 414 boundary would land
 * inside the 500 band.
 */
export const BUDGET = 5000;

export function buildBugUrl(
  consoleText: string,
  ctx: { href: string; userAgent: string; lang: string } = {
    href: location.href,
    userAgent: navigator.userAgent,
    lang: document.documentElement.lang,
  },
): string {
  const u = new URL(`${REPO}/issues/new`);
  u.searchParams.set('template', 'bug_report.yml');
  u.searchParams.set('labels', 'bug');
  u.searchParams.set('page-url', ctx.href);
  u.searchParams.set('environment', `${ctx.userAgent} · lang=${ctx.lang}`);

  // Newest lines matter most, so truncate from the head.
  let logs = consoleText;
  const withLogs = (s: string) => {
    const probe = new URL(u.toString());
    probe.searchParams.set('console-output', s || '(buffer empty)');
    return probe.toString();
  };
  while (logs.length > 0 && withLogs(logs).length > BUDGET) {
    const nl = logs.indexOf('\n');
    logs = nl === -1 ? '' : logs.slice(nl + 1);
  }

  u.searchParams.set('console-output', logs || '(buffer empty)');
  return u.toString();
}
