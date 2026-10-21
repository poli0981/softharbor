// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { describe, expect, it } from 'vitest';
import { project, run } from './fixture';

const GOOD_SW =
  'precacheAndRoute([{url:"offline.html"},{url:"_astro/f.woff2"},{url:"_astro/a.css"},' +
  '{url:"_astro/theme.js"}]);new NetworkOnly();handlerDidError("/offline");self.skipWaiting();';
const OFFLINE =
  '<link rel="stylesheet" href="/_astro/a.css"><script src="/_astro/theme.js"></script>';
const HOME = '<script defer src="/registerSW.js"></script><link rel="manifest" href="/m.json">';

const dist = (over: Record<string, string> = {}): Record<string, string> => ({
  'dist/sw.js': GOOD_SW,
  'dist/offline.html': OFFLINE,
  'dist/index.html': HOME,
  ...over,
});

describe('check-service-worker', () => {
  it('passes the shape docs/08 Part D describes', () => {
    const r = run('check-service-worker.mjs', project(dist()));
    expect(r.code).toBe(0);
    expect(r.out).toContain('check-service-worker — OK');
  });

  it.each([
    {
      name: 'a navigation fallback',
      over: { 'dist/sw.js': `${GOOD_SW}new NavigationRoute(h)` },
      message: 'NavigationRoute is registered',
    },
    {
      name: 'an unstyled offline page',
      over: { 'dist/sw.js': GOOD_SW.replace('{url:"_astro/a.css"},', '') },
      message: '/offline loads /_astro/a.css but the SW does not precache it',
    },
    {
      name: 'no precached fonts',
      over: { 'dist/sw.js': GOOD_SW.replace('{url:"_astro/f.woff2"},', '') },
      message: 'no fonts precached',
    },
    {
      name: 'no skipWaiting',
      over: { 'dist/sw.js': GOOD_SW.replace('self.skipWaiting();', '') },
      message: 'does not call skipWaiting',
    },
    {
      name: 'no NetworkOnly navigation route',
      over: { 'dist/sw.js': GOOD_SW.replace('NetworkOnly', 'CacheFirst') },
      message: 'no NetworkOnly navigation route',
    },
    {
      name: 'an unlinked manifest',
      over: { 'dist/index.html': '<script src="/registerSW.js"></script>' },
      message: 'does not link the web app manifest',
    },
    {
      name: 'an unregistered service worker',
      over: { 'dist/index.html': '<link rel="manifest" href="/m.json">' },
      message: 'registerSW.js is not referenced',
    },
  ])('fails on $name', ({ over, message }) => {
    const r = run('check-service-worker.mjs', project(dist(over)));
    expect(r.code).toBe(1);
    expect(r.out).toContain(message);
  });

  it('fails when there is no service worker at all', () => {
    const r = run('check-service-worker.mjs', project({ 'dist/index.html': HOME }));
    expect(r.code).toBe(1);
    expect(r.out).toContain('dist/sw.js does not exist');
  });
});
