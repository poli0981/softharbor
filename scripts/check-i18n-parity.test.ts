// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { describe, expect, it } from 'vitest';
import { project, run } from './fixture';

const BOM = String.fromCharCode(0xfeff);
const dicts = (en: unknown, vi: unknown): Record<string, string> => ({
  'src/i18n/en.json': JSON.stringify(en),
  'src/i18n/vi.json': JSON.stringify(vi),
});

describe('check-i18n-parity', () => {
  it('passes when every locale mirrors English, nested keys included', () => {
    const root = project(dicts({ a: 'A', b: { c: 'C {n}' } }, { a: 'Á', b: { c: 'Cê {n}' } }));
    const r = run('check-i18n-parity.mjs', root);
    expect(r.code).toBe(0);
    expect(r.out).toContain('OK (2 keys × 2 locales)');
  });

  it('reports missing and extra keys', () => {
    const root = project(dicts({ a: 'A', b: 'B' }, { a: 'A', z: 'Z' }));
    const r = run('check-i18n-parity.mjs', root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('vi.json → missing "b"');
    expect(r.out).toContain('vi.json → extra "z"');
  });

  it('reports an empty object as its own key instead of flattening it away', () => {
    const root = project(dicts({ a: 'A', x: {} }, { a: 'A' }));
    expect(run('check-i18n-parity.mjs', root).out).toContain('vi.json → missing "x"');
  });

  it('catches a translation that drops or renames a {placeholder}', () => {
    const root = project(dicts({ n: '{count} apps' }, { n: '{total} ứng dụng' }));
    const r = run('check-i18n-parity.mjs', root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('"n" placeholders {total} ≠ en {count}');
  });

  it('requires alphabetised keys', () => {
    const root = project(dicts({ b: 'B', a: 'A' }, { a: 'A', b: 'B' }));
    expect(run('check-i18n-parity.mjs', root).out).toContain(
      'en.json → keys not alphabetised (first: "b")',
    );
  });

  it('accepts a UTF-8 BOM and reports broken JSON without a stack trace', () => {
    const root = project({
      'src/i18n/en.json': `${BOM}{"a":"A"}`,
      'src/i18n/vi.json': '{"a": ',
    });
    const r = run('check-i18n-parity.mjs', root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('vi.json → not valid JSON');
    expect(r.out).not.toContain('en.json → not valid JSON');
    expect(r.out).not.toMatch(/^\s+at /m);
  });

  it('ignores helper files that are not locale dictionaries', () => {
    const root = project({ ...dicts({ a: 'A' }, { a: 'A' }), 'src/i18n/index.json': '{}' });
    expect(run('check-i18n-parity.mjs', root).out).toContain('× 2 locales');
  });
});
