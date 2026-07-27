// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/05 §A1 — the single most load-bearing function in the codebase.

/** Lowercase, strip Vietnamese diacritics, fold đ/Đ, collapse whitespace. */
export function normalizeViet(input: string): string {
  return input
    .normalize('NFD') // decompose: ệ → e + ◌̂ + ◌̣
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .replace(/đ/g, 'd') // NFD does NOT decompose đ/Đ —
    .replace(/Đ/g, 'D') // must fold explicitly
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
