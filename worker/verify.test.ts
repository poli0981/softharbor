// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// POST /api/verify against a stubbed Siteverify. Every refusal is pinned by
// status AND code, because the page decides fail-open vs. retry from them.

import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import worker from './index';
import { ACTION, handleVerify, SITEVERIFY, type VerifyDeps } from './verify';

const ORIGIN = 'https://softharbor.net';
const NOW = Date.parse('2026-10-21T12:00:00Z');
const SECRET = '0x4AAAAAAA-real-looking-secret';

function request(
  body: unknown = { token: 'tok' },
  init: { method?: string; headers?: Record<string, string>; raw?: string } = {},
): Request {
  const method = init.method ?? 'POST';
  return new Request(`${ORIGIN}/api/verify`, {
    method,
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.7',
      ...init.headers,
    },
    ...(method === 'POST' ? { body: init.raw ?? JSON.stringify(body) } : {}),
  });
}

/** Siteverify's answer for a person who passed on our host just now. */
const PASSED = {
  success: true,
  hostname: 'softharbor.net',
  action: ACTION,
  challenge_ts: new Date(NOW - 5000).toISOString(),
};

function setup(answers: Array<Response | Error> = [Response.json(PASSED)], env: Partial<Env> = {}) {
  const calls: FormData[] = [];
  const log = vi.fn<VerifyDeps['log']>();
  const queue = [...answers];
  const deps: VerifyDeps = {
    fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(SITEVERIFY);
      calls.push(init?.body as FormData);
      const next = queue.shift() ?? Response.json(PASSED);
      if (next instanceof Error) throw next;
      return next;
    }),
    now: () => NOW,
    log,
  };
  const fullEnv: Env = {
    ASSETS: { fetch: async () => new Response('asset') },
    TURNSTILE_SECRET: SECRET,
    ...env,
  };
  return { deps, env: fullEnv, calls, log };
}

async function verify(req: Request, s = setup()) {
  const res = await handleVerify(req, s.env, s.deps);
  return { res, body: (await res.json()) as Record<string, unknown>, ...s };
}

describe('POST /api/verify', () => {
  it('accepts a token Siteverify vouches for, sending it the secret, token and IP', async () => {
    const { res, body, calls } = await verify(request({ token: 'tok' }));
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    const form = calls[0]!;
    expect(form.get('secret')).toBe(SECRET);
    expect(form.get('response')).toBe('tok');
    expect(form.get('remoteip')).toBe('203.0.113.7');
    expect(form.get('idempotency_key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('marks every answer uncacheable and carries its own security headers', async () => {
    for (const req of [request(), request(undefined, { method: 'GET' })]) {
      const { res } = await verify(req);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    }
  });

  it.each([
    ['another host', { ...PASSED, hostname: 'evil.test' }],
    ['another action', { ...PASSED, action: 'login' }],
    ['a stale challenge', { ...PASSED, challenge_ts: new Date(NOW - 301_000).toISOString() }],
    ['no timestamp', { ...PASSED, challenge_ts: undefined }],
    ['a spent token', { success: false, 'error-codes': ['timeout-or-duplicate'] }],
    ['a forged token', { success: false, 'error-codes': ['invalid-input-response'] }],
  ])('rejects %s with 403', async (_name, answer) => {
    const { res, body } = await verify(request(), setup([Response.json(answer)]));
    expect(res.status).toBe(403);
    expect(body).toEqual({ error: 'rejected' });
  });

  it('retries once, with the same idempotency key, when Siteverify stumbles', async () => {
    const s = setup([new Response('', { status: 502 }), Response.json(PASSED)]);
    const { res, calls } = await verify(request(), s);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.get('idempotency_key')).toBe(calls[0]!.get('idempotency_key'));
  });

  it.each([
    ['is down twice', [new Error('network'), new Response('', { status: 503 })]],
    ['answers garbage', [new Response('<html>', { status: 200 })]],
    [
      'reports an internal error',
      [Response.json({ success: false, 'error-codes': ['internal-error'] })],
    ],
    [
      'refuses our secret',
      [Response.json({ success: false, 'error-codes': ['invalid-input-secret'] })],
    ],
  ])('answers 503 when Siteverify %s, so the page fails open', async (_name, answers) => {
    const { res, body, log } = await verify(request(), setup(answers));
    expect(res.status).toBe(503);
    expect(body).toEqual({ error: 'unavailable' });
    if (_name === 'refuses our secret') {
      expect(log).toHaveBeenCalledWith({ event: 'verify.secret_refused', level: 'error' });
    }
  });

  it('answers 503 without calling Siteverify while no secret is configured', async () => {
    const s = setup(undefined, { TURNSTILE_SECRET: '' });
    const { res, body } = await verify(request(), s);
    expect(res.status).toBe(503);
    expect(body).toEqual({ error: 'not_configured' });
    expect(s.deps.fetch).not.toHaveBeenCalled();
  });

  it('lets the test secrets through whatever placeholders they answer with', async () => {
    const s = setup([Response.json({ success: true, hostname: 'example.com', action: '' })], {
      TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
    });
    expect((await verify(request(), s)).res.status).toBe(200);
  });

  it('refuses other methods with 405 and an Allow header', async () => {
    const { res, body } = await verify(request(undefined, { method: 'GET' }));
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
    expect(body).toEqual({ error: 'method_not_allowed' });
  });

  it.each([
    ['no Origin', { origin: '' }],
    ['another origin', { origin: 'https://evil.test' }],
    ['a look-alike origin', { origin: 'https://softharbor.net.evil.test' }],
  ])('refuses %s with 403', async (_name, headers) => {
    const { res, body } = await verify(request(undefined, { headers }));
    expect(res.status).toBe(403);
    expect(body).toEqual({ error: 'bad_origin' });
  });

  it('rate-limits per client, before reading the body', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const s = setup(undefined, { VERIFY_LIMITER: { limit } });
    const { res, body } = await verify(request(), s);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(body).toEqual({ error: 'rate_limited' });
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
    expect(s.deps.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a non-JSON media type',
      request(undefined, { headers: { 'content-type': 'text/plain' } }),
      415,
      'unsupported_media_type',
    ],
    [
      'an oversized body',
      request(undefined, { raw: JSON.stringify({ token: 'x'.repeat(5000) }) }),
      413,
      'payload_too_large',
    ],
    ['malformed JSON', request(undefined, { raw: '{"token":' }), 400, 'invalid_json'],
    ['no token', request({}), 400, 'invalid_token'],
    ['an empty token', request({ token: '' }), 400, 'invalid_token'],
    ['a non-string token', request({ token: 42 }), 400, 'invalid_token'],
    ['an over-long token', request({ token: 'x'.repeat(2049) }), 400, 'invalid_token'],
    ['an array body', request(['tok']), 400, 'invalid_token'],
  ])('refuses %s', async (_name, req, status, code) => {
    const { res, body } = await verify(req);
    expect(res.status).toBe(status);
    expect(body).toEqual({ error: code });
  });

  it('logs one line per request, with no IP address or token in it', async () => {
    const { log } = await verify(request({ token: 'secret-token-value' }));
    expect(log).toHaveBeenCalledWith({ event: 'verify', outcome: 'ok', ms: 0 });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('203.0.113.7');
    expect(logged).not.toContain('secret-token-value');
  });
});

describe('the Worker entry', () => {
  it('routes /api/verify to the handler and everything else to the assets', async () => {
    const assets = vi.fn(async () => new Response('page'));
    const env: Env = { ASSETS: { fetch: assets } };

    const page = await worker.fetch(new Request(`${ORIGIN}/apps`), env);
    expect(await page.text()).toBe('page');
    expect(assets).toHaveBeenCalledTimes(1);

    const api = await worker.fetch(request(), env); // no secret configured
    expect(api.status).toBe(503);
    expect(assets).toHaveBeenCalledTimes(1);
  });
});
