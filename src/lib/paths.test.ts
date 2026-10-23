// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { describe, expect, it, vi } from 'vitest';
import { appPathsEn, appPathsVi, byAddedDesc, categoryPathsEn, categoryPathsVi } from './paths';

// paths.ts builds getStaticPaths from the content layer, so the virtual
// module is stubbed with two tiny collections.
vi.mock('astro:content', () => ({
  getCollection: vi.fn(async (name: string) =>
    name === 'apps' ? [{ id: '7-zip', data: {} }] : [{ id: 'utilities', data: {} }],
  ),
}));

const entry = (name: string, addedAt: string) => ({ data: { name, addedAt } });

describe('byAddedDesc — category page order', () => {
  it('lists newest first, then by name in the grid order', () => {
    const sorted = [
      entry('Zed', '2026-07-01'),
      entry('Chocolatey', '2026-07-30'),
      entry('Écrit', '2026-07-30'),
      entry('7-Zip', '2026-07-30'),
      entry('cherrytree', '2026-07-30'),
      entry('Hugin', '2026-07-30'),
    ]
      .sort(byAddedDesc)
      .map((e) => e.data.name);
    // Czech collation would put "ch…" after "Hugin"; the pinned order must not.
    expect(sorted).toEqual(['7-Zip', 'cherrytree', 'Chocolatey', 'Écrit', 'Hugin', 'Zed']);
  });
});

describe('getStaticPaths builders', () => {
  it('emit one route per app and per category, carrying the page locale', async () => {
    expect(await appPathsEn()).toEqual([
      { params: { slug: '7-zip' }, props: { app: { id: '7-zip', data: {} }, locale: 'en' } },
    ]);
    expect((await appPathsVi())[0]?.props.locale).toBe('vi');
    expect(await categoryPathsEn()).toEqual([
      {
        params: { id: 'utilities' },
        props: { category: { id: 'utilities', data: {} }, locale: 'en' },
      },
    ]);
    expect((await categoryPathsVi())[0]?.props.locale).toBe('vi');
  });
});
