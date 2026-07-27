// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// Vector table from docs/05 §A1 + docs/11 §2. Spike S2.

import { describe, expect, it } from 'vitest';
import { normalizeViet } from './normalize';

describe('normalizeViet — docs/05 §A1 vector table', () => {
  it.each([
    ['Trình duyệt', 'trinh duyet'],
    ['TRÌNH DUYỆT', 'trinh duyet'],
    ['Đồ hoạ  &  Thiết kế', 'do hoa & thiet ke'],
    ['đĐ', 'dd'],
    ['7-Zip', '7-zip'],
    ['Ứng dụng', 'ung dung'],
    ['', ''],
    ['   ', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeViet(input)).toBe(expected);
  });

  it('is encoding-agnostic: NFC and NFD inputs converge', () => {
    const nfc = 'Trình duyệt'.normalize('NFC');
    const nfd = 'Trình duyệt'.normalize('NFD');
    expect(nfc).not.toBe(nfd); // guard: the fixture really is two encodings
    expect(normalizeViet(nfd)).toBe('trinh duyet');
    expect(normalizeViet(nfc)).toBe(normalizeViet(nfd));
  });

  it('is idempotent — it runs on both index and query side (docs/05 §A2)', () => {
    for (const s of ['Đình Vũ', 'Ứng dụng', 'Trình duyệt']) {
      expect(normalizeViet(normalizeViet(s))).toBe(normalizeViet(s));
    }
  });

  it('folds đ/Đ, which NFD alone does not', () => {
    // The whole reason the explicit replace exists.
    expect('đ'.normalize('NFD')).toBe('đ');
    expect(normalizeViet('Đình Vũ')).toBe('dinh vu');
  });
});
