// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { afterEach, describe, expect, it } from 'vitest';
import { isHuman, PASS_TTL_MS, rememberHuman, UNVERIFIED_TTL_MS } from './human';

const NOW = Date.parse('2026-10-21T12:00:00Z');

function installStorage(mode: 'ok' | 'throws', seed?: string): Map<string, string> {
  const map = new Map<string, string>();
  if (seed !== undefined) map.set('sh:human', seed);
  const guard = () => {
    if (mode === 'throws') throw new DOMException('denied', 'SecurityError');
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (guard(), map.get(k) ?? null),
      setItem: (k: string, v: string) => (guard(), void map.set(k, v)),
    },
  });
  return map;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
  Reflect.deleteProperty(globalThis, '__shHumanUntil');
});

describe('sh:human (docs/09 §4a)', () => {
  it('holds a pass for 48 hours and an unverified pass for one', () => {
    const map = installStorage('ok');
    rememberHuman(PASS_TTL_MS, NOW);
    expect(map.get('sh:human')).toBe(String(NOW + PASS_TTL_MS));
    Reflect.deleteProperty(globalThis, '__shHumanUntil'); // a new page: storage only
    expect(isHuman(NOW + PASS_TTL_MS - 1)).toBe(true);
    expect(isHuman(NOW + PASS_TTL_MS)).toBe(false);

    rememberHuman(UNVERIFIED_TTL_MS, NOW);
    Reflect.deleteProperty(globalThis, '__shHumanUntil');
    expect(isHuman(NOW + UNVERIFIED_TTL_MS - 1)).toBe(true);
    expect(isHuman(NOW + UNVERIFIED_TTL_MS)).toBe(false);
  });

  it('ignores garbage, and expiries no check of ours could have written', () => {
    for (const junk of ['', ' ', 'yes', 'NaN', 'Infinity', String(NOW + PASS_TTL_MS + 1)]) {
      installStorage('ok', junk);
      expect(isHuman(NOW), JSON.stringify(junk)).toBe(false);
    }
  });

  it('carries the result in memory when storage is blocked', () => {
    installStorage('throws');
    expect(isHuman(NOW)).toBe(false);
    rememberHuman(PASS_TTL_MS, NOW);
    expect(isHuman(NOW + 1)).toBe(true);
  });
});
