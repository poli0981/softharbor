// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The ONE piece of server code (CLAUDE.md hard rule 1, D25, D32). It runs
// first for the paths in `assets.run_worker_first` (wrangler.jsonc): every
// page, feed and data file, but not the content-hashed assets, icons or the
// service worker. It does two things and serves nothing of its own:
//   1. the site-wide rate limit (worker/limit.ts) — over it, a 429;
//   2. POST /api/verify, the legal gate's Turnstile check (worker/verify.ts).
// Everything else is handed straight to the asset server.

import type { Env } from './env';
import { siteLimit } from './limit';
import { handleVerify } from './verify';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const log = (entry: Record<string, unknown>) => console.log(JSON.stringify(entry));
    const refused = await siteLimit(request, env, log);
    if (refused) return refused;
    if (new URL(request.url).pathname === '/api/verify') {
      return handleVerify(request, env, {
        // Wrapped: calling the global fetch detached from globalThis throws
        // "Illegal invocation" in workerd.
        fetch: (input, init) => fetch(input, init),
        now: Date.now,
        log,
      });
    }
    // Exactly what the asset server would have answered without the Worker:
    // ASSETS.fetch() applies html_handling, not_found_handling (the site's
    // 404 page) and public/_headers — checked under `wrangler dev` and on a
    // preview version, 2026-10-26.
    return env.ASSETS.fetch(request);
  },
};
