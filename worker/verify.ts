// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// POST /api/verify — the server half of the legal gate's human check
// (ShLegalGate step 2, docs/09 §4a). The page sends the Turnstile token it
// received; this asks Cloudflare's Siteverify whether a person really passed
// the widget, on this site, for this purpose, just now.
//
// It gates nothing by itself: SoftHarbor is a public static site and every
// page is served without asking. The verdict only decides whether the gate
// remembers the visitor as checked (48 h) or lets them through unchecked —
// and every failure on OUR side (no secret, Siteverify down, rate limited)
// answers 5xx/429 so the page fails OPEN. A person is never locked out by an
// outage.

import type { Env } from './env';
import { HttpError, isObject, json, rateKey, readJson } from './http';

export const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
/** The widget's `action` (src/lib/turnstile.ts). A token minted for anything else is refused. */
export const ACTION = 'legal_gate';
/** Siteverify expires tokens after 300 s itself; this re-checks with our clock. */
const MAX_TOKEN_AGE_MS = 300_000;
const MAX_BODY_BYTES = 4096;
const MAX_TOKEN_LENGTH = 2048;
const SITEVERIFY_TIMEOUT_MS = 4000;

/**
 * - ok: a person passed the widget on this host, for the gate, recently.
 * - rejected: the token is invalid, spent, or was minted elsewhere.
 * - unavailable: Siteverify could not answer, or refused our secret.
 */
export type Verdict = 'ok' | 'rejected' | 'unavailable';

export interface VerifyDeps {
  /** Injected so tests need no network. In the Worker: `(u, i) => fetch(u, i)`. */
  fetch: typeof fetch;
  now: () => number;
  /** One structured line per request. Never given an IP address or a token. */
  log: (entry: Record<string, unknown>) => void;
}

/** Cloudflare's documented test secrets (1x… passes, 2x… fails, 3x… "already spent"). */
export function isTestSecret(secret: string): boolean {
  return /^[123]x0+AA$/.test(secret);
}

interface Check {
  secret: string;
  token: string;
  /** cf-connecting-ip, '' when absent. Sent to Siteverify, never logged. */
  ip: string;
  /** The host the widget must have run on: the one this request came to. */
  hostname: string;
}

export async function siteverify(check: Check, deps: VerifyDeps): Promise<Verdict> {
  // One retry on a network failure or 5xx, with the SAME idempotency key, so
  // Siteverify answers the retry instead of calling the token spent.
  const idempotencyKey = crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    const form = new FormData();
    form.set('secret', check.secret);
    form.set('response', check.token);
    if (check.ip) form.set('remoteip', check.ip);
    form.set('idempotency_key', idempotencyKey);
    let res: Response;
    try {
      res = await deps.fetch(SITEVERIFY, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
      });
    } catch {
      continue;
    }
    if (res.status >= 500) continue;
    if (!res.ok) return 'unavailable';
    let outcome: unknown;
    try {
      outcome = await res.json();
    } catch {
      return 'unavailable';
    }
    return judge(outcome, check, deps);
  }
  return 'unavailable';
}

function judge(outcome: unknown, check: Check, deps: VerifyDeps): Verdict {
  if (!isObject(outcome)) return 'unavailable';
  if (outcome['success'] !== true) {
    const codes = Array.isArray(outcome['error-codes']) ? outcome['error-codes'] : [];
    if (codes.includes('missing-input-secret') || codes.includes('invalid-input-secret')) {
      // Ours to fix, not the visitor's: say so loudly in Workers Logs.
      deps.log({ event: 'verify.secret_refused', level: 'error' });
      return 'unavailable';
    }
    return codes.includes('internal-error') ? 'unavailable' : 'rejected';
  }
  // The test secrets answer with placeholder hostname/action/timestamp values.
  if (isTestSecret(check.secret)) return 'ok';
  if (outcome['hostname'] !== check.hostname || outcome['action'] !== ACTION) return 'rejected';
  const issued =
    typeof outcome['challenge_ts'] === 'string' ? Date.parse(outcome['challenge_ts']) : NaN;
  return deps.now() - issued <= MAX_TOKEN_AGE_MS ? 'ok' : 'rejected';
}

export async function handleVerify(
  request: Request,
  env: Env,
  deps: VerifyDeps,
): Promise<Response> {
  const started = deps.now();
  let outcome = 'ok';
  try {
    if (request.method !== 'POST')
      throw new HttpError(405, 'method_not_allowed', { Allow: 'POST' });
    const url = new URL(request.url);
    // Same-origin only. Compared with the URL this request arrived on, so
    // preview hosts and `wrangler dev` work without a hostname list.
    if (request.headers.get('origin') !== url.origin) throw new HttpError(403, 'bad_origin');
    const secret = env.TURNSTILE_SECRET;
    if (!secret) throw new HttpError(503, 'not_configured');
    if (
      env.VERIFY_LIMITER &&
      !(await env.VERIFY_LIMITER.limit({ key: rateKey(request) })).success
    ) {
      throw new HttpError(429, 'rate_limited', { 'Retry-After': '60' });
    }
    const body = await readJson(request, MAX_BODY_BYTES);
    const token = isObject(body) ? body['token'] : undefined;
    if (typeof token !== 'string' || token === '' || token.length > MAX_TOKEN_LENGTH) {
      throw new HttpError(400, 'invalid_token');
    }
    const verdict = await siteverify(
      {
        secret,
        token,
        ip: request.headers.get('cf-connecting-ip') ?? '',
        hostname: url.hostname,
      },
      deps,
    );
    if (verdict === 'unavailable') throw new HttpError(503, 'unavailable');
    if (verdict === 'rejected') throw new HttpError(403, 'rejected');
    return json({ ok: true });
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'internal_error');
    outcome = err.code;
    if (!(e instanceof HttpError)) {
      deps.log({ event: 'verify.crash', level: 'error', error: String(e) });
    }
    return json({ error: err.code }, err.status, err.headers);
  } finally {
    deps.log({ event: 'verify', outcome, ms: deps.now() - started });
  }
}
