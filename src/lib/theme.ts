// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/05 §A8 — theme resolution. `src/scripts/theme.js` applies the same
// rule before first paint; this module is the typed version the ShPrefs menu
// uses afterwards. Keep the two in sync (prefs.test.ts runs the real script):
// theme.js cannot import from here because it ships verbatim, unbundled.

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'sh:theme';

export function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    // Private mode / storage disabled — behave as if unset rather than throw.
    return 'system';
  }
}

export function writeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Preference simply does not persist; the applied theme still changes.
  }
}

export function prefersDark(): boolean {
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolve(choice: ThemeChoice, systemDark = prefersDark()): ResolvedTheme {
  if (choice === 'system') return systemDark ? 'dark' : 'light';
  return choice;
}

export function applyTheme(resolved: ResolvedTheme, root: HTMLElement): void {
  root.dataset['theme'] = resolved;
}
