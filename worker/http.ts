// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

/**
 * Headers for every response the Worker builds. public/_headers is applied by
 * the asset server only, so none of it reaches these: they need their own.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Verdicts are per-request; nothing between us and the browser may keep one.
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS,
      ...headers,
    },
  });
}

/** A refusal: `status` and `code` become the JSON response. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Record<string, string>;

  constructor(status: number, code: string, headers: Record<string, string> = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * The JSON body, refusing more than `maxBytes` WHILE it streams in, so a body
 * sent without Content-Length is never buffered past the cap. The media type
 * must be exactly application/json: `text/plain` is what a cross-site form or
 * no-preflight fetch can send, and it is refused here.
 */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const type = (request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, 'unsupported_media_type');
  const declared = request.headers.get('content-length');
  if (declared !== null && !(Number(declared) <= maxBytes)) {
    throw new HttpError(413, 'payload_too_large');
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(413, 'payload_too_large');
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

/**
 * Rate-limit key: the IPv4 address, or the /64 of an IPv6 one (a single host
 * can rotate through its whole /64). Never logged.
 */
export function rateKey(request: Request): string {
  const ip = (request.headers.get('cf-connecting-ip') ?? '').trim().toLowerCase();
  if (!ip) return 'unknown';
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (v4?.[1]) return v4[1]; // IPv4, including IPv4-mapped IPv6
  const [head = '', tail] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const fill =
    tail === undefined ? [] : Array<string>(Math.max(8 - left.length - right.length, 0)).fill('0');
  const groups = [...left, ...fill, ...right].slice(0, 4).map((g) => g.replace(/^0+(?=.)/, ''));
  return `${groups.join(':')}::/64`;
}
