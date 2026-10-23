// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// `pnpm icons` — run for real in a throwaway tree. The PNG bytes depend on
// sharp's version, so they are checked by their headers; the vector mark is
// plain text and must equal the committed public/favicon.svg, which would
// otherwise drift from the script that claims to produce it.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { project, run } from './fixture';

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (buf: Buffer) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

describe('gen-icons.mjs', () => {
  it('writes every icon from the one vector mark', () => {
    const root = project({});
    const r = run('gen-icons.mjs', root);
    expect(r.code).toBe(0);
    expect(r.out).toContain('icons — wrote favicon.svg');

    const svg = readFileSync(join(root, 'public/favicon.svg'), 'utf8');
    expect(svg).toBe(readFileSync(join(process.cwd(), 'public/favicon.svg'), 'utf8'));

    const pngs: Array<[string, number]> = [
      ['icons/icon-192.png', 192],
      ['icons/icon-512.png', 512],
      ['icons/maskable-512.png', 512],
      ['apple-touch-icon.png', 180],
    ];
    for (const [file, size] of pngs) {
      const buf = readFileSync(join(root, 'public', file));
      expect(buf.subarray(1, 4).toString('latin1'), file).toBe('PNG');
      expect(pngSize(buf), file).toEqual([size, size]);
    }
  });

  it('packs 16, 32 and 48 px PNGs into favicon.ico', () => {
    const root = project({});
    expect(run('gen-icons.mjs', root).code).toBe(0);

    const ico = readFileSync(join(root, 'public/favicon.ico'));
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(3); // three images
    const entries = [0, 1, 2].map((i) => 6 + 16 * i);
    expect(entries.map((e) => ico.readUInt8(e))).toEqual([16, 32, 48]);
    // Each directory entry points at a PNG inside the file.
    for (const e of entries) {
      const offset = ico.readUInt32LE(e + 12);
      expect(ico.subarray(offset + 1, offset + 4).toString('latin1')).toBe('PNG');
    }
  });
});
