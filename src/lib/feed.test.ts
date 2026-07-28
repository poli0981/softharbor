// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/11 §2 — "feed builder | deterministic output; top-50 cutoff; stable guid".

import { describe, expect, it } from 'vitest';
import { buildExport, feedItems, FEED_LIMIT, type FeedApp } from './feed';

const SITE = 'https://softharbor.net';

const app = (slug: string, name: string, addedAt: string): FeedApp => ({
  slug,
  name,
  summaryEn: `Summary for ${name}.`,
  addedAt,
});

const APPS: FeedApp[] = [
  app('7-zip', '7-Zip', '2026-07-20'),
  app('firefox', 'Firefox', '2026-07-28'),
  app('krita', 'Krita', '2026-07-25'),
  app('vlc', 'VLC media player', '2026-07-25'),
];

describe('feedItems — docs/05 §A4', () => {
  it('sorts newest first', () => {
    expect(feedItems(APPS, SITE).map((i) => i.guid)).toEqual(['firefox', 'krita', 'vlc', '7-zip']);
  });

  it('breaks same-day ties by name, so ordering is a function of the DATA', () => {
    // krita and vlc share 2026-07-25. If this order could vary between builds,
    // notify.py would re-announce on a redeploy with no data change.
    const order = feedItems(APPS, SITE).map((i) => i.guid);
    expect(order.indexOf('krita')).toBeLessThan(order.indexOf('vlc'));
  });

  it('is deterministic — same data in any input order gives identical output', () => {
    const shuffled = [APPS[3]!, APPS[0]!, APPS[2]!, APPS[1]!];
    expect(JSON.stringify(feedItems(shuffled, SITE))).toBe(JSON.stringify(feedItems(APPS, SITE)));
  });

  it('does not mutate its input', () => {
    const before = APPS.map((a) => a.slug);
    feedItems(APPS, SITE);
    expect(APPS.map((a) => a.slug)).toEqual(before);
  });

  it(`caps at ${FEED_LIMIT}`, () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      app(`app-${i}`, `App ${i}`, `2026-01-${String((i % 28) + 1).padStart(2, '0')}`),
    );
    expect(feedItems(many, SITE)).toHaveLength(FEED_LIMIT);
  });

  it('pubDate is midnight UTC of addedAt, never build time', () => {
    const [first] = feedItems(APPS, SITE);
    expect(first?.pubDate.toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  it('guid is the bare slug — stable and permanent (docs/04 §2)', () => {
    expect(feedItems(APPS, SITE).map((i) => i.guid)).not.toContain(SITE);
    expect(feedItems(APPS, SITE)[0]?.guid).toBe('firefox');
  });

  it('link is absolute and points at the EN detail page', () => {
    expect(feedItems(APPS, SITE)[0]?.link).toBe('https://softharbor.net/apps/firefox');
  });
});

describe('buildExport — docs/03 §6', () => {
  const apps = [
    { slug: 'vlc', name: 'VLC' },
    { slug: '7-zip', name: '7-Zip' },
  ];

  it('carries the frozen contract fields', () => {
    const out = buildExport(apps, '2026-07-28T00:00:00Z');
    expect(out.schemaVersion).toBe(1);
    expect(out.count).toBe(2);
    expect(out.license).toBe('CC-BY-SA-4.0');
    // Attribution must name the project and point at the repo — it is the
    // string re-users are asked to reproduce (docs/14 Part 1).
    expect(out.attribution).toContain('SoftHarbor contributors');
    expect(out.attribution).toContain('github.com/poli0981/softharbor');
    expect(out.generatedAt).toBe('2026-07-28T00:00:00Z');
  });

  it('uses schemaVersion, NOT $schema — $schema conventionally holds a URI', () => {
    expect(Object.keys(buildExport(apps, 'x'))).not.toContain('$schema');
  });

  it('sorts by slug so consumers get a stable document', () => {
    expect(buildExport(apps, 'x').apps.map((a) => a.slug)).toEqual(['7-zip', 'vlc']);
  });
});
