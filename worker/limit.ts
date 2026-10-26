// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The site-wide rate limit (D32). Every request that runs the Worker — every
// page, feed, sitemap, the search index and /api/* — spends one unit of a
// per-client budget (SITE_LIMITER, wrangler.jsonc) before anything else
// happens. Content-hashed assets, icons and the service worker never get
// here (`run_worker_first`'s negative patterns): they are only ever fetched
// by a page that already passed, so a page never half-loads because its CSS
// was refused, and they stay on the unbilled asset path.
//
// Like the rest of the Worker it fails OPEN: no binding, no client address,
// or a limiter that throws all serve the request as if there were no limit.

import type { Env } from './env';
import { json, rateKey, SECURITY_HEADERS } from './http';

/** SITE_LIMITER's `period` (wrangler.jsonc): a refused client may retry one window later. */
export const RETRY_AFTER_S = 10;
/** The branded, bilingual refusal (src/pages/errors/429.astro), served from the build. */
export const ERROR_PAGE = '/errors/429';

/**
 * `undefined` when the request may go on, otherwise the 429 to answer with.
 * `log` gets one line per refusal, never an IP address.
 */
export async function siteLimit(
  request: Request,
  env: Env,
  log: (entry: Record<string, unknown>) => void,
): Promise<Response | undefined> {
  // Without an address there is no client to tell apart, and one shared
  // "unknown" bucket would throttle everyone in it together.
  if (!env.SITE_LIMITER || !request.headers.get('cf-connecting-ip')) return undefined;
  try {
    if ((await env.SITE_LIMITER.limit({ key: rateKey(request) })).success) return undefined;
  } catch {
    return undefined;
  }
  const { pathname } = new URL(request.url);
  const api = pathname.startsWith('/api/');
  log({ event: 'rate_limited', kind: api ? 'api' : 'page' });
  return api ? apiRefusal(pathname) : pageRefusal(request, env);
}

function apiRefusal(pathname: string): Response {
  const headers: Record<string, string> = { 'Retry-After': String(RETRY_AFTER_S) };
  // The public dataset is CORS-open (public/_headers), so its refusal must be
  // too — otherwise a cross-origin consumer sees a network error instead of
  // the 429 and its Retry-After. /api/verify is same-origin only.
  if (pathname !== '/api/verify') {
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Expose-Headers'] = 'Retry-After';
  }
  return json({ error: 'rate_limited' }, 429, headers);
}

async function pageRefusal(request: Request, env: Env): Promise<Response> {
  try {
    const page = await env.ASSETS.fetch(
      new Request(new URL(ERROR_PAGE, request.url), {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      }),
    );
    if (page.ok) {
      // The asset server's headers (public/_headers: frame-ancestors,
      // nosniff, …) stay; only caching changes, because a refusal is about
      // this client at this moment.
      const headers = new Headers(page.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('Retry-After', String(RETRY_AFTER_S));
      headers.delete('ETag');
      return new Response(page.body, { status: 429, headers });
    }
  } catch {
    // The plain refusal below still says what happened.
  }
  return new Response(`429 Too Many Requests — Quá nhiều yêu cầu. Retry in ${RETRY_AFTER_S} s.\n`, {
    status: 429,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': String(RETRY_AFTER_S),
      ...SECURITY_HEADERS,
    },
  });
}
