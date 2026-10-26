// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The site-wide rate limit (D32) against a stubbed limiter and asset server.
// The real binding, routing and _headers are exercised end to end by
// e2e/worker.spec.ts under `wrangler dev`.

import { unstable_readConfig } from 'wrangler';
import { describe, expect, it, vi } from 'vitest';
import type { Env, RateLimiter } from './env';
import worker from './index';
import { ERROR_PAGE, RETRY_AFTER_S, siteLimit } from './limit';

const ORIGIN = 'https://softharbor.net';
const IP = '203.0.113.7';

function get(path: string, init: { method?: string; ip?: string | null } = {}): Request {
  const headers: Record<string, string> = {};
  if (init.ip !== null) headers['cf-connecting-ip'] = init.ip ?? IP;
  return new Request(`${ORIGIN}${path}`, { method: init.method ?? 'GET', headers });
}

/** The built 429 page, as the asset server returns it (headers from public/_headers). */
const errorPage = (req: Request) =>
  new Response(req.method === 'HEAD' ? null : '<title>Too many requests — SoftHarbor</title>', {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      ETag: '"abc"',
      'X-Frame-Options': 'DENY',
    },
  });

function setup(
  success: boolean | Error = false,
  assets = vi.fn(async (r: Request) => errorPage(r)),
) {
  const limit = vi.fn<RateLimiter['limit']>(async () => {
    if (success instanceof Error) throw success;
    return { success };
  });
  const log = vi.fn();
  const env: Env = { ASSETS: { fetch: assets }, SITE_LIMITER: { limit } };
  return { env, limit, log, assets };
}

describe('siteLimit', () => {
  it('lets a client under the limit through, counted by IPv4 address or IPv6 /64', async () => {
    const s = setup(true);
    expect(await siteLimit(get('/apps'), s.env, s.log)).toBeUndefined();
    expect(await siteLimit(get('/apps', { ip: '2001:db8:1:2:3:4:5:6' }), s.env, s.log)).toBe(
      undefined,
    );
    expect(s.limit.mock.calls).toEqual([[{ key: IP }], [{ key: '2001:db8:1:2::/64' }]]);
    expect(s.assets).not.toHaveBeenCalled();
    expect(s.log).not.toHaveBeenCalled();
  });

  it('answers an over-limit page request with the branded 429 page', async () => {
    const s = setup();
    const res = await siteLimit(get('/apps/7-zip'), s.env, s.log);
    expect(res?.status).toBe(429);
    expect(res?.headers.get('retry-after')).toBe(String(RETRY_AFTER_S));
    expect(res?.headers.get('cache-control')).toBe('no-store');
    expect(res?.headers.get('etag')).toBeNull();
    // The asset server's own security headers are kept.
    expect(res?.headers.get('x-frame-options')).toBe('DENY');
    expect(await res?.text()).toContain('Too many requests');
    const fetched = s.assets.mock.calls[0]![0];
    expect(fetched.url).toBe(`${ORIGIN}${ERROR_PAGE}`);
    expect(fetched.method).toBe('GET');
  });

  it('asks for the page with HEAD when the client did, and sends no body', async () => {
    const s = setup();
    const res = await siteLimit(get('/rss.xml', { method: 'HEAD' }), s.env, s.log);
    expect(res?.status).toBe(429);
    expect(s.assets.mock.calls[0]![0].method).toBe('HEAD');
    expect(res?.body).toBeNull();
  });

  it('answers /api/* with JSON, CORS-readable for the public dataset', async () => {
    const s = setup();
    const res = await siteLimit(get('/api/apps.json'), s.env, s.log);
    expect(res?.status).toBe(429);
    expect(await res?.json()).toEqual({ error: 'rate_limited' });
    expect(res?.headers.get('retry-after')).toBe(String(RETRY_AFTER_S));
    expect(res?.headers.get('access-control-allow-origin')).toBe('*');
    expect(res?.headers.get('access-control-expose-headers')).toBe('Retry-After');
    expect(res?.headers.get('cache-control')).toBe('no-store');
    expect(s.assets).not.toHaveBeenCalled();
  });

  it('keeps /api/verify same-origin when it refuses it', async () => {
    const s = setup();
    const res = await siteLimit(get('/api/verify', { method: 'POST' }), s.env, s.log);
    expect(res?.status).toBe(429);
    expect(await res?.json()).toEqual({ error: 'rate_limited' });
    expect(res?.headers.get('access-control-allow-origin')).toBeNull();
  });

  it.each([
    ['a missing page', async () => new Response('nope', { status: 404 })],
    [
      'an asset server that throws',
      async (): Promise<Response> => {
        throw new Error('down');
      },
    ],
  ])('still refuses in plain text when the 429 page is %s', async (_name, fetchPage) => {
    const s = setup(false, vi.fn(fetchPage));
    const res = await siteLimit(get('/apps'), s.env, s.log);
    expect(res?.status).toBe(429);
    expect(res?.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(res?.headers.get('retry-after')).toBe(String(RETRY_AFTER_S));
    expect(res?.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(await res?.text()).toContain('429 Too Many Requests');
  });

  it('fails open: no binding, no client address, or a limiter that throws', async () => {
    const none = setup();
    expect(await siteLimit(get('/apps'), { ASSETS: none.env.ASSETS }, none.log)).toBeUndefined();

    const anonymous = setup();
    expect(await siteLimit(get('/apps', { ip: null }), anonymous.env, anonymous.log)).toBe(
      undefined,
    );
    expect(anonymous.limit).not.toHaveBeenCalled();

    const broken = setup(new Error('limiter down'));
    expect(await siteLimit(get('/apps'), broken.env, broken.log)).toBeUndefined();
  });

  it('logs one line per refusal — its kind, never the address', async () => {
    const s = setup();
    await siteLimit(get('/apps'), s.env, s.log);
    await siteLimit(get('/api/apps.json'), s.env, s.log);
    expect(s.log.mock.calls).toEqual([
      [{ event: 'rate_limited', kind: 'page' }],
      [{ event: 'rate_limited', kind: 'api' }],
    ]);
    expect(JSON.stringify(s.log.mock.calls)).not.toContain(IP);
  });
});

describe('the Worker entry', () => {
  it('checks the limit before anything else, /api/verify included', async () => {
    const s = setup();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const page = await worker.fetch(get('/apps'), s.env);
      expect(page.status).toBe(429);
      const verify = await worker.fetch(get('/api/verify', { method: 'POST' }), s.env);
      expect(verify.status).toBe(429);
      // Only the 429 page was fetched, never the page that was asked for.
      expect(s.assets.mock.calls.map(([r]) => new URL(r.url).pathname)).toEqual([ERROR_PAGE]);
      expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
        event: 'rate_limited',
        kind: 'page',
      });
    } finally {
      log.mockRestore();
    }
  });

  it('hands a request under the limit to the asset server untouched', async () => {
    const assets = vi.fn(async () => new Response('page'));
    const s = setup(true, assets);
    const req = get('/apps');
    const res = await worker.fetch(req, s.env);
    expect(await res.text()).toBe('page');
    expect(assets).toHaveBeenCalledWith(req);
  });
});

/** What these tests read of wrangler.jsonc (wrangler's own Config type does not resolve here). */
interface WranglerConfig {
  assets?: { run_worker_first?: boolean | string[] };
  ratelimits: { name: string; namespace_id: string; simple: { limit: number; period: number } }[];
}

describe('wrangler.jsonc', () => {
  const config = unstable_readConfig(
    { config: 'wrangler.jsonc' },
    { hideWarnings: true },
  ) as WranglerConfig;

  it('routes every request through the Worker except the files a page loads', () => {
    const list = config.assets?.run_worker_first;
    if (!Array.isArray(list)) throw new Error('run_worker_first must be a list of patterns');
    expect(list).toContain('/*');
    // A page that passed the limit must load whole: its scripts, styles and
    // fonts (/_astro/) and the service worker never meet the limiter.
    for (const path of ['/_astro/*', '/sw.js', '/registerSW.js', '/workbox-*.js']) {
      expect(list).toContain(`!${path}`);
    }
  });

  it('declares both limiters, and Retry-After matches the site window', () => {
    const byName = Object.fromEntries(config.ratelimits.map((r) => [r.name, r]));
    expect(byName['SITE_LIMITER']?.simple.period).toBe(RETRY_AFTER_S);
    expect(byName['SITE_LIMITER']?.simple.limit).toBeGreaterThan(0);
    expect(byName['VERIFY_LIMITER']?.simple).toEqual({ limit: 20, period: 60 });
    // Counters are shared by namespace across the account: never reuse one.
    const ids = config.ratelimits.map((r) => r.namespace_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
