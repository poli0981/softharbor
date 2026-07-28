// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/05 §A5 — in-memory console ring buffer feeding the bug-report flow.
//
// Privacy (docs/09 §8): captures only exception text from our own origin.
// Never wraps console.*, never reads input values, never leaves the page
// until the user explicitly opens a bug report (§A6).

const CAP = 20;
const MAX_LINE = 500;
const buf: string[] = [];

/** Exported for tests; the listeners below are the only production callers. */
export function push(line: string, now = new Date()): void {
  buf.push(`[${now.toISOString()}] ${line}`.slice(0, MAX_LINE));
  if (buf.length > CAP) buf.shift();
}

export const getBuffer = (): string => buf.join('\n');

export const clearBuffer = (): void => void buf.splice(0, buf.length);

/** Idempotent: calling twice must not double-record every error. */
let attached = false;

export function attach(target: Window): void {
  if (attached) return;
  attached = true;
  target.addEventListener('error', (e) => push(`error: ${e.message} @ ${e.filename}:${e.lineno}`));
  target.addEventListener('unhandledrejection', (e) =>
    push(`unhandledrejection: ${String(e.reason).slice(0, 400)}`),
  );
}
