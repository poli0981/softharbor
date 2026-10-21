// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

import { describe, expect, it } from 'vitest';
import { HttpError, rateKey, readJson } from './http';

const withIp = (ip: string) =>
  new Request('https://x.test/', { headers: { 'cf-connecting-ip': ip } });

describe('rateKey', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['2001:db8:1:2:3:4:5:6', '2001:db8:1:2::/64'],
    ['2001:0db8:0001:0002::6', '2001:db8:1:2::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['', 'unknown'],
  ])('%s → %s', (ip, key) => {
    expect(rateKey(withIp(ip))).toBe(key);
  });
});

describe('readJson', () => {
  const post = (body: BodyInit, headers: Record<string, string> = {}) =>
    new Request('https://x.test/', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', ...headers },
    });

  it('parses a body within the cap', async () => {
    expect(await readJson(post('{"a":1}'), 100)).toEqual({ a: 1 });
  });

  it('accepts a charset parameter, but nothing other than application/json', async () => {
    expect(
      await readJson(post('{}', { 'content-type': 'application/json; charset=utf-8' }), 10),
    ).toEqual({});
    await expect(
      readJson(post('{}', { 'content-type': 'text/plain; application/json' }), 10),
    ).rejects.toMatchObject({
      status: 415,
    });
  });

  it('stops reading a streamed body as soon as it passes the cap', async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(64));
      },
    });
    const req = new Request('https://x.test/', {
      method: 'POST',
      body: stream,
      headers: { 'content-type': 'application/json' },
      duplex: 'half',
    } as RequestInit);
    const err = await readJson(req, 100).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(413);
    expect(pulled).toBeLessThan(10);
  });
});
