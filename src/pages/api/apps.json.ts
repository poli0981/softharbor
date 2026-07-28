// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/03 §6 — the public dataset export.
//
// This is a FROZEN contract: breaking its shape requires a schemaVersion bump
// and a decision-log entry. It also exists so that "acceptable use" in the
// Terms can point somewhere instead of just asking people not to scrape
// (docs/14 §3c). CORS is opened for it alone, in public/_headers.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildExport } from '../../lib/feed';

export const GET: APIRoute = async () => {
  const apps = await getCollection('apps');

  const payload = buildExport(
    apps.map((app) => ({
      // Exactly the schema of docs/04 §1, plus `slug`. The collection schema
      // is .strict(), so this cannot silently grow.
      slug: app.id,
      ...app.data,
      // Reference objects carry loader internals; publish the plain ids.
      categories: app.data.categories.map((c) => c.id),
    })),
    new Date().toISOString(),
  );

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
