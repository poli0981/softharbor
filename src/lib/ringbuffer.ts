// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/05 §A5 — reader for the console ring buffer.
//
// The buffer is FILLED by public/errors.js, which is loaded early from
// Base.astro. It cannot live in this module: ShBugReport is client:visible in
// the footer (docs/02 §5), so listeners attached at hydration would miss every
// error that happened before the user scrolled — the ones a bug report is
// actually about. The two halves meet on `window.__shErrors`.
//
// Privacy (docs/09 §8): in-memory only, page lifetime, never transmitted until
// the user opens a report themselves.

const GLOBAL_KEY = '__shErrors';

function raw(): string[] {
  const v = (globalThis as Record<string, unknown>)[GLOBAL_KEY];
  return Array.isArray(v) ? (v as string[]) : [];
}

/** Newest-last, joined for the issue body. Empty string when nothing happened. */
export function getBuffer(): string {
  return raw().join('\n');
}

export function bufferSize(): number {
  return raw().length;
}
