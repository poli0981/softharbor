// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/05 §A7 + docs/14 Part 2 — legal-gate version check.
//
// Route exemptions used to live here as a path regex (/legal, /404, /offline,
// /errors). That never matched the cases that matter: Workers serves 404.html
// at whatever URL was requested, and the service worker serves the offline
// page at the URL that failed, so both showed the gate. Exempt pages now
// declare it themselves (`<Base gateExempt>`), and the island is simply not
// rendered there.

/**
 * The version of the ACCEPTED set — Disclaimer, Terms and Privacy Policy, the
 * three documents the gate asks for. Bump it when any of those three changes
 * materially: it re-opens the gate for everyone (docs/14 Part 2). The other
 * documents only move their own date in LEGAL_UPDATED.
 *
 * History: 2026-07-28 (H6 approval of the docs/14 drafts); 2026-07-30 (when
 * this constant still dated every page, it moved with the new AI
 * Disclosure); 2026-10-21 (v1.1: the Privacy Policy now covers Cloudflare
 * Web Analytics and the Turnstile check, and Terms gained the operator and a
 * copyright-complaint procedure).
 */
export const LEGAL_VERSION = '2026-10-21';

export type LegalDoc =
  'aiDisclosure' | 'disclaimer' | 'privacy' | 'terms' | 'thirdParty' | 'trademarks';

/** The documents the gate asks you to accept. */
export const ACCEPTED_DOCS = [
  'disclaimer',
  'privacy',
  'terms',
] as const satisfies readonly LegalDoc[];

/**
 * When each document last changed in substance — its "Last updated" line.
 * One date for all six used to stamp documents that had not changed.
 */
export const LEGAL_UPDATED: Readonly<Record<LegalDoc, string>> = {
  aiDisclosure: '2026-10-23',
  disclaimer: '2026-10-21',
  privacy: '2026-10-21',
  terms: '2026-10-21',
  thirdParty: '2026-10-21',
  trademarks: '2026-10-21',
};

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
