// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// D23 — the monogram fallback and the three-form logo dispatcher (docs/04 §2).

import { describe, expect, it } from 'vitest';
import { UnknownIconError } from './icon';
import { UnknownLogoError, initials, logoSvg } from './logo';

describe('initials', () => {
  it.each([
    ['7-Zip', '7Z'], // digit-led, hyphen splits the words
    ['Total Commander', 'TC'],
    ['O&O ShutUp10', 'OO'], // "O", "O", "ShutUp10" — first letter of the first two
    ['btop', 'BT'], // single lowercase word → first two characters
    ['mpv', 'MP'],
    ['CPU-Z', 'CZ'],
    ['Sweet Home 3D', 'SH'],
    ['paint.net', 'PN'],
    ['X', 'X'], // single character, nothing to pad with
    ['Trình duyệt', 'TD'], // diacritics folded before slicing
    ['Đồ hoạ', 'DH'],
    ['', '?'],
    ['&&&', '?'], // no alphanumerics at all
  ])('%j → %j', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('never emits a bare combining mark', () => {
    // Slicing an NFD string without folding first would split "ì" into
    // "i" + U+0300, and the monogram would render a floating accent.
    for (const name of ['Ứng dụng', 'Đình Vũ', 'ố']) {
      expect(initials(name)).toMatch(/^[A-Z0-9?]{1,2}$/);
    }
  });
});

describe('logoSvg', () => {
  const attrs = { class: 'size-10', 'aria-hidden': 'true', fill: 'currentColor' };

  it('delegates simple-icons: to the vendored set', () => {
    const out = logoSvg('simple-icons:firefoxbrowser', 'Firefox', attrs);
    expect(out).toMatch(/^<svg /);
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain('class="size-10"');
    expect(out).toContain('<path');
  });

  it('still throws on an unknown simple-icons name, rather than rendering blank', () => {
    // docs/03 §2: a missing logo must fail the build next to its entry.
    expect(() => logoSvg('simple-icons:notabrand', 'Nope', attrs)).toThrow(UnknownIconError);
  });

  it('renders a monogram carrying the initials', () => {
    const out = logoSvg('monogram', 'VeraCrypt', attrs);
    expect(out).toContain('>VE<');
    expect(out).toContain('<rect');
    expect(out).toContain('class="size-10"');
  });

  it('themes the monogram entirely through currentColor', () => {
    // Any literal colour here would break dark mode, which swaps the token
    // rather than the markup.
    const out = logoSvg('monogram', 'Rufus', attrs);
    expect(out).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(out).not.toMatch(/\b(rgb|hsl)\(/);
  });

  it('emits no style attribute — CSP style-src would silently drop it (D20)', () => {
    // This is the check:styles rule, enforced here too so the failure lands
    // in the unit suite instead of after a full build.
    for (const name of ['7-Zip', 'O&O ShutUp10', 'btop']) {
      expect(logoSvg('monogram', name, attrs)).not.toMatch(/\sstyle="/);
    }
  });

  it('escapes the initials it interpolates', () => {
    // initials() already restricts the charset; this guards the guard.
    const out = logoSvg('monogram', '<script>', attrs);
    expect(out).not.toContain('<script>');
  });

  it('throws a named error for a local: asset that is not on disk', () => {
    expect(() => logoSvg('local:nothing-here.svg', 'Ghost', attrs)).toThrow(UnknownLogoError);
  });
});
