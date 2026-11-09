// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Display preferences beyond the theme — the scrollbar, motion and keyboard
// shortcut choices the ShPrefs menu offers (v1.1; shortcut v1.4). Typed helpers in the shape of theme.ts and
// lang.ts: every localStorage key on the site has exactly one reader and one
// writer, so the privacy inventory (docs/09 §8) stays true.
//
// src/scripts/theme.js applies the same rules before first paint; it cannot
// import from here (it ships verbatim, unbundled), so keep the two in sync —
// prefs.test.ts runs the real script to pin that.

export type ScrollbarChoice = 'auto' | 'thin' | 'hidden';
export type MotionChoice = 'system' | 'reduce';
/** The single-key "/" shortcut (WCAG 2.1.4: it must be possible to turn it off). */
export type KeysChoice = 'on' | 'off';

export const SCROLLBAR_KEY = 'sh:scrollbar';
export const MOTION_KEY = 'sh:motion';
export const KEYS_KEY = 'sh:keys';

const SCROLLBARS: readonly ScrollbarChoice[] = ['auto', 'thin', 'hidden'];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Storage disabled: defaults apply, nothing throws.
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // The choice still applies for this page; it just does not persist.
  }
}

export function readScrollbar(): ScrollbarChoice {
  const v = read(SCROLLBAR_KEY);
  return SCROLLBARS.includes(v as ScrollbarChoice) ? (v as ScrollbarChoice) : 'auto';
}

/** `auto` is the default and is stored as "no key", like theme's `system`. */
export function writeScrollbar(choice: ScrollbarChoice): void {
  write(SCROLLBAR_KEY, choice === 'auto' ? null : choice);
}

export function applyScrollbar(choice: ScrollbarChoice, root: HTMLElement): void {
  if (choice === 'auto') delete root.dataset['scrollbar'];
  else root.dataset['scrollbar'] = choice;
}

export function readMotion(): MotionChoice {
  return read(MOTION_KEY) === 'reduce' ? 'reduce' : 'system';
}

export function writeMotion(choice: MotionChoice): void {
  write(MOTION_KEY, choice === 'reduce' ? 'reduce' : null);
}

export function applyMotion(choice: MotionChoice, root: HTMLElement): void {
  if (choice === 'reduce') root.dataset['motion'] = 'reduce';
  else delete root.dataset['motion'];
}

export function readKeys(): KeysChoice {
  return read(KEYS_KEY) === 'off' ? 'off' : 'on';
}

/** `on` is the default and is stored as "no key". */
export function writeKeys(choice: KeysChoice): void {
  write(KEYS_KEY, choice === 'off' ? 'off' : null);
}

export function applyKeys(choice: KeysChoice, root: HTMLElement): void {
  if (choice === 'off') root.dataset['keys'] = 'off';
  else delete root.dataset['keys'];
}

/**
 * Whether the "/" shortcut may act. Read from the attribute theme.js sets
 * before first paint (and ShPrefs keeps current), so every island agrees
 * without importing storage.
 */
export function shortcutsEnabled(root: HTMLElement = document.documentElement): boolean {
  return root.dataset['keys'] !== 'off';
}
