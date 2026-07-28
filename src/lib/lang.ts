// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/07 §2 — the `sh:lang` preference.
//
// Storage lives behind a typed helper like `sh:theme` and `sh:legal`
// (docs/10 §3), so every localStorage key on the site has exactly one reader
// and one writer and the privacy inventory in docs/09 §8 stays true.
//
// Note what this preference does NOT do: there is no automatic locale
// redirect (D13). Its only job is remembering that the suggestion banner has
// been answered, so it never asks twice.

import type { Locale } from './locale';

const KEY = 'sh:lang';

export function readLangPref(): Locale | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'en' || v === 'vi' ? v : null;
  } catch {
    return null;
  }
}

export function writeLangPref(locale: Locale): void {
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    // Private mode: the banner may reappear next session. Acceptable — the
    // alternative is refusing to navigate, which is worse.
  }
}
