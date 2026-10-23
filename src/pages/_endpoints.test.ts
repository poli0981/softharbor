// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The three data endpoints, run against a stubbed content layer. Their logic
// lives in src/lib (feed.ts, search.ts) and is tested there; what is pinned
// here is the wiring: which fields leave the collection, the guid seam in the
// feed, and the export's plain category ids. The leading `_` keeps this file
// out of Astro's routing.

import type { APIContext } from 'astro';
import MiniSearch from 'minisearch';
import { describe, expect, it, vi } from 'vitest';
import { miniSearchOptions, type SearchDoc } from '../lib/searchOptions';

const APPS = [
  {
    id: 'zeta-tool',
    data: {
      name: 'Zeta Tool',
      summary: { en: 'Zeta summary & more', vi: 'Tóm tắt Zeta' },
      tags: ['cli'],
      categories: [{ id: 'utilities', collection: 'categories' }],
      addedAt: '2026-07-28',
    },
  },
  {
    id: 'alpha-app',
    data: {
      name: 'Alpha App',
      summary: { en: 'Alpha summary', vi: 'Tóm tắt Alpha' },
      tags: ['portable', 'editor'],
      categories: [
        { id: 'ide-editor', collection: 'categories' },
        { id: 'developer-tools', collection: 'categories' },
      ],
      addedAt: '2026-10-21',
    },
  },
];

vi.mock('astro:content', () => ({ getCollection: async () => APPS }));

const context = (site?: string) =>
  ({ site: site ? new URL(site) : undefined }) as unknown as APIContext;

describe('/rss.xml', () => {
  it('lists the newest first with the bare slug as a non-permalink guid', async () => {
    const { GET } = await import('./rss.xml');
    const xml = await (await GET(context('https://softharbor.net'))).text();

    const guids = [...xml.matchAll(/<guid isPermaLink="false">([^<]+)<\/guid>/g)].map((m) => m[1]);
    expect(guids).toEqual(['alpha-app', 'zeta-tool']);
    expect(xml).toContain('<link>https://softharbor.net/apps/alpha-app</link>');
    expect(xml).toContain('Zeta summary &amp; more');
    // No channel-level build date: a redeploy must not change the bytes.
    expect(xml).not.toContain('<lastBuildDate>');
  });

  it('falls back to the canonical origin when the build has no `site`', async () => {
    const { GET } = await import('./rss.xml');
    const xml = await (await GET(context())).text();
    expect(xml).toContain('<link>https://softharbor.net/apps/zeta-tool</link>');
  });
});

describe('/search-index.json', () => {
  it('serves a loadable MiniSearch index over the raw fields', async () => {
    const { GET } = await import('./search-index.json');
    const res = await GET(context());
    expect(res.headers.get('Content-Type')).toBe('application/json');

    const json = await res.text();
    // `as never`, as in src/lib/searchIndex.ts: the options are a readonly
    // literal, MiniSearch's Options type wants mutable arrays.
    const index = MiniSearch.loadJSON<SearchDoc>(json, miniSearchOptions as never);
    expect(index.documentCount).toBe(2);
    expect(index.search('portable').map((r) => r.id)).toEqual(['alpha-app']);
  });
});

describe('/api/apps.json', () => {
  it('exports every entry with its slug and plain category ids', async () => {
    const { GET } = await import('./api/apps.json');
    const res = await GET(context());
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');

    const body = (await res.json()) as {
      schemaVersion: number;
      count: number;
      apps: Array<{ slug: string; categories: string[]; name: string }>;
    };
    expect(body.schemaVersion).toBe(1);
    expect(body.count).toBe(2);
    expect(body.apps.map((a) => a.slug)).toEqual(['alpha-app', 'zeta-tool']);
    expect(body.apps[0]?.categories).toEqual(['ide-editor', 'developer-tools']);
    expect(body.apps[0]?.name).toBe('Alpha App');
  });
});
