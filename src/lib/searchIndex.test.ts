// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/05 §A2 — the client index loader.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildIndex, type SearchDoc } from './search';
import { INDEX_URL, loadSearchIndex, resetSearchIndex } from './searchIndex';

const DOCS: SearchDoc[] = [
  {
    slug: 'firefox',
    name: 'Firefox',
    tags: ['browser'],
    summaryEn: 'Web browser',
    summaryVi: 'Trình duyệt web',
  },
  {
    slug: 'gimp',
    name: 'GIMP',
    tags: ['image'],
    summaryEn: 'Image editor',
    summaryVi: 'Chỉnh sửa ảnh',
  },
];
const SERIALIZED = JSON.stringify(buildIndex(DOCS));

const ok = () => new Response(SERIALIZED, { status: 200 });

afterEach(() => resetSearchIndex());

describe('loadSearchIndex', () => {
  it('loads the prebuilt index and searches it across locales', async () => {
    const index = await loadSearchIndex(async () => ok());
    expect(index.search('trinh duyet').map((r) => r.id)).toEqual(['firefox']);
  });

  it('downloads once for a burst of callers', async () => {
    const fetchImpl = vi.fn(async () => ok());
    await Promise.all([
      loadSearchIndex(fetchImpl),
      loadSearchIndex(fetchImpl),
      loadSearchIndex(fetchImpl),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(INDEX_URL);
  });

  it('rejects on an HTTP error instead of parsing an error page', async () => {
    await expect(
      loadSearchIndex(async () => new Response('<!doctype html>', { status: 404 })),
    ).rejects.toThrow('HTTP 404');
  });

  it('forgets a failure, so the next interaction retries', async () => {
    const fetchImpl = vi
      .fn<(input: string) => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(ok());
    await expect(loadSearchIndex(fetchImpl)).rejects.toThrow('offline');
    await expect(loadSearchIndex(fetchImpl)).resolves.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
