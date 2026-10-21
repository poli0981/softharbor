// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/05 §A1 — the single most load-bearing function in the codebase.

/** Combining diacritical marks, U+0300–U+036F (what NFD splits accents into). */
const COMBINING = /[\u0300-\u036f]/g;
/**
 * Zero-width space, non-joiner, joiner and the BOM / zero-width no-break space.
 * Invisible, but they split a term in two: a pasted "fire\u200bfox" would
 * otherwise never match "firefox".
 */
const ZERO_WIDTH = /[\u200b-\u200d\ufeff]/g;

/** Lowercase, strip Vietnamese diacritics, fold đ/Đ, collapse whitespace. */
export function normalizeViet(input: string): string {
  return input
    .normalize('NFD') // decompose: ệ → e + ◌̂ + ◌̣
    .replace(COMBINING, '') // strip combining marks
    .replace(ZERO_WIDTH, '')
    .replace(/đ/g, 'd') // NFD does NOT decompose đ/Đ —
    .replace(/Đ/g, 'D') // must fold explicitly
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
