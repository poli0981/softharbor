// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The ONE piece of server code (CLAUDE.md hard rule 1, D25). It runs first
// only for the paths in `assets.run_worker_first` (wrangler.jsonc) — today
// just /api/verify. Every page, asset and feed is served by the asset server
// without running this, exactly as before it existed.

import type { Env } from './env';
import { handleVerify } from './verify';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === '/api/verify') {
      return handleVerify(request, env, {
        // Wrapped: calling the global fetch detached from globalThis throws
        // "Illegal invocation" in workerd.
        fetch: (input, init) => fetch(input, init),
        now: Date.now,
        log: (entry) => console.log(JSON.stringify(entry)),
      });
    }
    // A request that matched no asset and is not a navigation (a missing
    // image or JSON file) still lands here — navigations get 404.html from
    // the asset server directly. ASSETS.fetch() applies the same
    // not_found_handling, so the answer is the site's normal 404.
    return env.ASSETS.fetch(request);
  },
};
