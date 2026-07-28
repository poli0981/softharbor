// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/11 §2 — i18n helper. The parity assertion here mirrors what CI runs.

import { describe, expect, it } from 'vitest';
import en from './en.json';
import vi from './vi.json';
import { localeFromPath, localePair, localePath, t } from './index';

describe('t() — lookup and interpolation', () => {
  it('returns the locale string', () => {
    expect(t('en', 'nav.apps')).toBe('Apps');
    expect(t('vi', 'nav.apps')).toBe('Ứng dụng');
  });

  it('substitutes every occurrence of a variable', () => {
    expect(t('en', 'footer.builtAt', { date: '27 Jul 2026' })).toBe('Built 27 Jul 2026');
    expect(t('vi', 'footer.builtAt', { date: '27/07/2026' })).toContain('27/07/2026');
  });

  it('leaves an unreplaced placeholder visible rather than blanking it', () => {
    // A missing var should be obvious in review, not silently empty.
    expect(t('en', 'footer.builtAt')).toContain('{date}');
  });
});

describe('dictionary parity (hard rule 6 — same check CI runs)', () => {
  it('EN and VI have identical key sets', () => {
    expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
  });

  it('no value is empty in either locale', () => {
    for (const [k, v] of Object.entries({ ...en, ...vi })) {
      expect(v, `empty value for ${k}`).not.toBe('');
    }
  });

  it('VI is actually translated, not copied from EN', () => {
    // Guard against a "translation" that is just the English pasted over.
    // The allowlist is deliberately exhaustive rather than a pattern: every
    // entry is a proper noun that Vietnamese also writes in Latin script, and
    // adding to it should require saying why (docs/07 §9 keeps the glossary).
    const PROPER_NOUNS = [
      'platform.linux',
      'platform.macos',
      'platform.windows',
      'site.name',
      'sort.name', // "A–Z" — the Latin range reads the same in Vietnamese
    ];
    const identical = Object.keys(en).filter(
      (k) => en[k as keyof typeof en] === vi[k as keyof typeof vi],
    );
    expect(identical.sort()).toEqual(PROPER_NOUNS);
  });
});

describe('locale routing (docs/07 §2/§5)', () => {
  it('builds locale paths — en unprefixed, vi under /vi', () => {
    expect(localePath('en', '/apps')).toBe('/apps');
    expect(localePath('vi', '/apps')).toBe('/vi/apps');
    expect(localePath('en', '/')).toBe('/');
    expect(localePath('vi', '/')).toBe('/vi');
  });

  it('localePair is symmetric — the same pair from either side', () => {
    expect(localePair('/apps')).toEqual({ en: '/apps', vi: '/vi/apps' });
    expect(localePair('/vi/apps')).toEqual({ en: '/apps', vi: '/vi/apps' });
    expect(localePair('/')).toEqual({ en: '/', vi: '/vi' });
    expect(localePair('/vi')).toEqual({ en: '/', vi: '/vi' });
  });

  it('detects locale from a path without matching lookalikes', () => {
    expect(localeFromPath('/vi')).toBe('vi');
    expect(localeFromPath('/vi/apps')).toBe('vi');
    expect(localeFromPath('/')).toBe('en');
    expect(localeFromPath('/apps')).toBe('en');
    // A slug that merely starts with "vi" is not the Vietnamese locale.
    expect(localeFromPath('/apps/vim')).toBe('en');
    expect(localeFromPath('/videos')).toBe('en');
  });
});
