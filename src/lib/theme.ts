// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/05 §A8 — theme resolution. `public/theme.js` applies the same rule
// before first paint; this module is the typed version the toggle island uses
// afterwards. Keep the two in sync: theme.js cannot import from here because
// it must ship unbundled at a stable path (docs/09 §4, D20).

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'sh:theme';

/** Cycle order for the toggle (docs/05 §A8). */
export const CYCLE: readonly ThemeChoice[] = ['system', 'light', 'dark'];

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

export function nextChoice(current: ThemeChoice): ThemeChoice {
  const i = CYCLE.indexOf(current);
  return CYCLE[(i + 1) % CYCLE.length] ?? 'system';
}
