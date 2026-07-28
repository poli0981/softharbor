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
 * Measured by spike S3 (2026-07-27) — see docs/11 §3 for the method and the
 * observed ceiling. Set well below the limit that actually fails, because the
 * failure mode is silent: GitHub does not error, it drops the prefill and the
 * user files a report with an empty console field.
 */
export const BUDGET = 6000;

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
