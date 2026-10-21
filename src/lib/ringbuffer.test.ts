// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { afterEach, describe, expect, it } from 'vitest';
import { bufferSize, getBuffer } from './ringbuffer';

const g = globalThis as Record<string, unknown>;

afterEach(() => {
  Reflect.deleteProperty(globalThis, '__shErrors');
});

describe('ring buffer reader (docs/05 §A5)', () => {
  it('reads what errors.js recorded, newest last', () => {
    g['__shErrors'] = ['[error] first', '[warn] second'];
    expect(bufferSize()).toBe(2);
    expect(getBuffer()).toBe('[error] first\n[warn] second');
  });

  it('is empty when errors.js never ran or the global was clobbered', () => {
    expect(bufferSize()).toBe(0);
    expect(getBuffer()).toBe('');
    g['__shErrors'] = 'not an array';
    expect(bufferSize()).toBe(0);
    expect(getBuffer()).toBe('');
  });
});
