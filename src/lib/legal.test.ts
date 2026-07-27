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

describe('legal gate — route exemptions (docs/14 Part 2)', () => {
  it.each([
    '/legal',
    '/legal/disclaimer',
    '/legal/privacy',
    '/vi/legal',
    '/vi/legal/terms',
    '/404',
    '/offline',
    '/errors/403',
    '/errors/429',
  ])('exempt: %s', async (path) => {
    const m = await import('./legal');
    expect(m.isExempt(path)).toBe(true);
  });

  it.each([
    '/',
    '/apps',
    '/apps/7-zip',
    '/categories/browser',
    '/vi/',
    '/vi/apps',
    '/vi/apps/7-zip',
    // Guard against a sloppy prefix match letting real pages through.
    '/legalish',
    '/apps/legal-notes',
    '/offlinely',
  ])('gated: %s', async (path) => {
    const m = await import('./legal');
    expect(m.isExempt(path)).toBe(false);
  });
});
