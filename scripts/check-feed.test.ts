// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { describe, expect, it } from 'vitest';
import { project, run } from './fixture';

const item = (slug: string, date = 'Tue, 28 Jul 2026 00:00:00 GMT', guid?: string) =>
  `<item><title>${slug}</title><link>https://softharbor.net/apps/${slug}</link>` +
  `${guid ?? `<guid isPermaLink="false">${slug}</guid>`}<pubDate>${date}</pubDate></item>`;
const feed = (...items: string[]) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${items.join('')}</channel></rss>`;
const apps = (...slugs: string[]) =>
  Object.fromEntries(slugs.map((s) => [`src/data/apps/${s}.json`, '{}']));

describe('check-feed', () => {
  it('passes the shape notify.py relies on', () => {
    const root = project({
      ...apps('gimp', 'vlc'),
      'dist/rss.xml': feed(item('vlc', 'Wed, 29 Jul 2026 00:00:00 GMT'), item('gimp')),
    });
    const r = run('check-feed.mjs', root);
    expect(r.code).toBe(0);
    expect(r.out).toContain('OK (2 items');
  });

  it.each([
    [
      'a URL guid',
      item('vlc', undefined, '<guid>https://softharbor.net/apps/vlc</guid>'),
      'isPermaLink',
    ],
    ['a guid naming no app', item('ghost'), 'names no app'],
    ['no guid at all', item('vlc', undefined, ''), '0 <guid> elements'],
    [
      'a capitalised guid',
      item('vlc', undefined, '<guid isPermaLink="false">VLC</guid>'),
      'is not a slug',
    ],
    ['an unparseable date', item('vlc', 'yesterday'), 'unparseable <pubDate>'],
  ])('fails on %s', (_name, bad, message) => {
    const r = run('check-feed.mjs', project({ ...apps('vlc'), 'dist/rss.xml': feed(bad) }));
    expect(r.code).toBe(1);
    expect(r.out).toContain(message);
  });

  it('fails on duplicates, older-before-newer, a wrong link and an empty feed', () => {
    const dup = run(
      'check-feed.mjs',
      project({ ...apps('vlc'), 'dist/rss.xml': feed(item('vlc'), item('vlc')) }),
    );
    expect(dup.out).toContain('duplicate guid "vlc"');

    const order = run(
      'check-feed.mjs',
      project({
        ...apps('vlc', 'gimp'),
        'dist/rss.xml': feed(item('vlc'), item('gimp', 'Wed, 29 Jul 2026 00:00:00 GMT')),
      }),
    );
    expect(order.out).toContain('newer than the item before it');

    const link = run(
      'check-feed.mjs',
      project({
        ...apps('vlc'),
        'dist/rss.xml': feed(item('vlc').replace('/apps/vlc', '/apps/vlc-player')),
      }),
    );
    expect(link.out).toContain('is not https://softharbor.net/apps/vlc');

    const empty = run('check-feed.mjs', project({ 'dist/rss.xml': feed() }));
    expect(empty.code).toBe(1);
    expect(empty.out).toContain('no <item>');
  });

  it('fails when the window grows past 50', () => {
    const slugs = Array.from({ length: 51 }, (_, i) => `app-${i}`);
    const r = run(
      'check-feed.mjs',
      project({ ...apps(...slugs), 'dist/rss.xml': feed(...slugs.map((s) => item(s))) }),
    );
    expect(r.out).toContain('51 items');
  });
});
