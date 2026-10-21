// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

/**
 * What the Worker receives (wrangler.jsonc). Typed by hand rather than with
 * @cloudflare/workers-types: these three members are all it uses, and the
 * global runtime types would collide with the DOM lib the site compiles
 * against.
 */
export interface Env {
  /** The static site itself (`assets.binding`). */
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Workers Rate Limiting (`ratelimits`). Absent under a bare `wrangler dev`. */
  VERIFY_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /**
   * Turnstile secret key. A RUNTIME secret (`wrangler secret put
   * TURNSTILE_SECRET` or the dashboard's Variables and Secrets) — a Workers
   * Builds *build* variable is invisible here. Missing → 503, and the page
   * fails open.
   */
  TURNSTILE_SECRET?: string;
}
