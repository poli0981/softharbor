// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/05 §A7 + docs/14 Part 2 — legal-gate version check and route exemptions.

/** Bump when ANY legal document changes; re-opens the gate for everyone. */
export const LEGAL_VERSION = '2026-07-27';

const KEY = 'sh:legal';

/**
 * Fail-open-per-session fallback (docs/14 Part 2). If localStorage throws —
 * private mode, storage disabled, quota — the gate shows once and acceptance
 * is held in memory for the rest of the session rather than dead-locking the
 * site on every navigation.
 *
 * Held on `globalThis`, not in a module-local `let`, on purpose: its real
 * scope IS the browsing session, and a module-local would survive
 * `vi.resetModules()` in any test that imports this module statically — one
 * test's acceptance would silently leak into every later one.
 */
const MEM_KEY = '__shLegalAcceptedThisSession';

function memoryAccepted(): boolean {
  return (globalThis as Record<string, unknown>)[MEM_KEY] === true;
}

export function isAccepted(): boolean {
  if (memoryAccepted()) return true;
  try {
    // Any value !== the current version re-opens the gate. That deliberately
    // includes OLD versions and garbage — never "startsWith", never a range.
    return localStorage.getItem(KEY) === LEGAL_VERSION;
  } catch {
    return false;
  }
}

export function acceptLegal(): void {
  (globalThis as Record<string, unknown>)[MEM_KEY] = true;
  try {
    localStorage.setItem(KEY, LEGAL_VERSION);
  } catch {
    // Storage unavailable — memoryAccepted carries this session.
  }
}

/**
 * Routes where the gate must never appear (docs/14 Part 2): the legal pages
 * themselves — so the gate can link to the documents it asks you to accept —
 * plus error/offline states, which would otherwise dead-lock.
 */
const EXEMPT = /^\/(?:vi\/)?(?:legal(?:\/|$)|404(?:\/|$)|offline(?:\/|$)|errors(?:\/|$))/;

export function isExempt(pathname: string): boolean {
  return EXEMPT.test(pathname);
}
