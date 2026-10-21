// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/09 §4a — the `sh:human` record: until when this browser counts as
// checked by the legal gate's Turnstile step.
//
// Stored as an expiry time, so the lifetime is decided once, when the check
// ends: 48 hours after a pass, 1 hour after the gate let someone through
// unchecked (Turnstile blocked, Siteverify down, the Worker unconfigured).
// The short one keeps an outage from asking on every page without letting
// "unchecked" stick for two days.

const KEY = 'sh:human';

export const PASS_TTL_MS = 48 * 60 * 60 * 1000;
export const UNVERIFIED_TTL_MS = 60 * 60 * 1000;

/**
 * Same fail-open-per-session fallback as src/lib/legal.ts: with storage
 * blocked the result is held in memory for the page's lifetime instead of
 * re-running the check forever. On globalThis for the same test-isolation
 * reason given there.
 */
const MEM_KEY = '__shHumanUntil';

export function isHuman(now = Date.now()): boolean {
  const mem = (globalThis as Record<string, unknown>)[MEM_KEY];
  if (typeof mem === 'number' && mem > now) return true;
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return false;
  }
  const until = raw === null || raw.trim() === '' ? NaN : Number(raw);
  // Anything further out than the longest lifetime was not written by us.
  return Number.isFinite(until) && until > now && until <= now + PASS_TTL_MS;
}

export function rememberHuman(ttlMs: number, now = Date.now()): void {
  const until = now + ttlMs;
  (globalThis as Record<string, unknown>)[MEM_KEY] = until;
  try {
    localStorage.setItem(KEY, String(until));
  } catch {
    // Storage unavailable — the in-memory copy carries this page.
  }
}
