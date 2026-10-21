// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// Spike S4 — docs/05 §A7, docs/14 Part 2.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Minimal localStorage stub; `mode` lets us simulate a hostile store. */
function installStorage(mode: 'ok' | 'throws' = 'ok', seed?: string) {
  const map = new Map<string, string>();
  if (seed !== undefined) map.set('sh:legal', seed);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(k: string) {
        if (mode === 'throws') throw new DOMException('denied', 'SecurityError');
        return map.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        if (mode === 'throws') throw new DOMException('denied', 'SecurityError');
        map.set(k, v);
      },
    },
  });
  return map;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
  Reflect.deleteProperty(globalThis, '__shLegalAcceptedThisSession');
  vi.resetModules();
});

describe('legal gate — version check (docs/05 §A7)', () => {
  beforeEach(() => vi.resetModules());

  it('is not accepted on a fresh browser', async () => {
    installStorage('ok');
    const m = await import('./legal');
    expect(m.isAccepted()).toBe(false);
  });

  it('accepts and persists the exact current version', async () => {
    const store = installStorage('ok');
    const m = await import('./legal');
    m.acceptLegal();
    expect(m.isAccepted()).toBe(true);
    expect(store.get('sh:legal')).toBe(m.LEGAL_VERSION);
  });

  it('re-opens for a STALE stored version', async () => {
    installStorage('ok', '2020-01-01');
    const m = await import('./legal');
    expect(m.isAccepted()).toBe(false);
  });

  it('re-opens for a NEWER stored version too — equality, not ordering', async () => {
    // A downgrade must not silently count as accepted (docs/11 §3 S4).
    installStorage('ok', '2099-12-31');
    const m = await import('./legal');
    expect(m.isAccepted()).toBe(false);
  });

  it('re-opens for garbage', async () => {
    installStorage('ok', 'true');
    const m = await import('./legal');
    expect(m.isAccepted()).toBe(false);
  });
});

describe('legal gate — hostile storage fails OPEN per session', () => {
  beforeEach(() => vi.resetModules());

  it('does not throw when localStorage is unavailable entirely', async () => {
    const m = await import('./legal'); // no localStorage on globalThis at all
    expect(() => m.isAccepted()).not.toThrow();
    expect(m.isAccepted()).toBe(false);
  });

  it('holds acceptance in memory when writes throw', async () => {
    installStorage('throws');
    const m = await import('./legal');
    expect(m.isAccepted()).toBe(false);
    expect(() => m.acceptLegal()).not.toThrow();
    // The gate must not re-appear on the next navigation this session.
    expect(m.isAccepted()).toBe(true);
  });
});

describe('legal versions and dates', () => {
  it('bumps the gate version whenever an accepted document changes', async () => {
    const { ACCEPTED_DOCS, LEGAL_UPDATED, LEGAL_VERSION } = await import('./legal');
    // A Disclaimer/Terms/Privacy change dated after the version would update
    // the page without asking anyone to accept it again.
    for (const doc of ACCEPTED_DOCS) expect(LEGAL_UPDATED[doc] <= LEGAL_VERSION, doc).toBe(true);
  });

  it('dates every document with a real day that has already happened', async () => {
    const { LEGAL_UPDATED, LEGAL_VERSION } = await import('./legal');
    const today = new Date().toISOString().slice(0, 10);
    for (const [doc, date] of Object.entries({ ...LEGAL_UPDATED, version: LEGAL_VERSION })) {
      expect(date, doc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10), doc).toBe(date);
      expect(date <= today, doc).toBe(true);
    }
  });
});
