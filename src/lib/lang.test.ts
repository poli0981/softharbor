// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { afterEach, describe, expect, it } from 'vitest';
import { readLangPref, writeLangPref } from './lang';

function installStorage(mode: 'ok' | 'throws', seed?: string): Map<string, string> {
  const map = new Map<string, string>();
  if (seed !== undefined) map.set('sh:lang', seed);
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
});

describe('sh:lang preference (docs/07 §2)', () => {
  it('round-trips a locale', () => {
    const map = installStorage('ok');
    expect(readLangPref()).toBeNull();
    writeLangPref('vi');
    expect(map.get('sh:lang')).toBe('vi');
    expect(readLangPref()).toBe('vi');
  });

  it('treats anything but en/vi as "no preference"', () => {
    for (const junk of ['', 'VI', 'fr', 'vi-VN', 'null']) {
      installStorage('ok', junk);
      expect(readLangPref(), junk).toBeNull();
    }
  });

  it('survives storage that throws, or does not exist', () => {
    installStorage('throws');
    expect(readLangPref()).toBeNull();
    expect(() => writeLangPref('en')).not.toThrow();
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(readLangPref()).toBeNull();
    expect(() => writeLangPref('en')).not.toThrow();
  });
});
