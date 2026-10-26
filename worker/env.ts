// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

/** A Workers Rate Limiting binding (`ratelimits` in wrangler.jsonc). */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * What the Worker receives (wrangler.jsonc). Typed by hand rather than with
 * @cloudflare/workers-types: these members are all it uses, and the global
 * runtime types would collide with the DOM lib the site compiles against.
 */
export interface Env {
  /** The static site itself (`assets.binding`). */
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** The site-wide limit (D32): every request that runs the Worker. Absent → no limit. */
  SITE_LIMITER?: RateLimiter;
  /** The stricter /api/verify limit (D25). Absent under a bare `wrangler dev`. */
  VERIFY_LIMITER?: RateLimiter;
  /**
   * Turnstile secret key. A RUNTIME secret (`wrangler secret put
   * TURNSTILE_SECRET` or the dashboard's Variables and Secrets) — a Workers
   * Builds *build* variable is invisible here. Missing → 503, and the page
   * fails open.
   */
  TURNSTILE_SECRET?: string;
}
