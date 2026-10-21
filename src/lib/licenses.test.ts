// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { productionLicenses } from './licenses';

let root: string | undefined;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

function tree(files: Record<string, unknown>): string {
  root = mkdtempSync(join(tmpdir(), 'sh-licenses-'));
  for (const [path, json] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify(json));
  }
  return root;
}

describe('productionLicenses (docs/14 §3e)', () => {
  it('lists every real runtime dependency with a declared license', () => {
    const list = productionLicenses();
    expect(list.length).toBeGreaterThan(5);
    expect(list.map((p) => p.name)).toEqual([...list.map((p) => p.name)].sort());
    expect(list.find((p) => p.name === 'svelte')).toMatchObject({ license: 'MIT' });
    expect(list.filter((p) => p.license === 'UNKNOWN')).toEqual([]);
  });

  it('reports the installed version, legacy license objects, and missing licenses', () => {
    const dir = tree({
      'package.json': { dependencies: { zeta: '^1', alpha: '^2', old: '*' } },
      'node_modules/zeta/package.json': { version: '1.4.0', license: 'Apache-2.0' },
      'node_modules/alpha/package.json': { version: '2.0.1' },
      'node_modules/old/package.json': { version: '0.1.0', license: { type: 'BSD-3-Clause' } },
    });
    expect(productionLicenses(dir)).toEqual([
      { name: 'alpha', version: '2.0.1', license: 'UNKNOWN' },
      { name: 'old', version: '0.1.0', license: 'BSD-3-Clause' },
      { name: 'zeta', version: '1.4.0', license: 'Apache-2.0' },
    ]);
  });
});
