// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/03 §3.2, docs/05 §A2 — the serialized MiniSearch index.
//
// Built once here, at build time, so the client pays zero indexing cost: it
// calls MiniSearch.loadJSON and is immediately ready. Fields are stored RAW —
// `processTerm` normalizes at addAll() time too, so what lands on disk is
// already folded, and query terms go through the identical function
// (docs/05 §A1). No *Norm duplicates.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildIndex, type SearchDoc } from '../lib/search';

export const GET: APIRoute = async () => {
  const apps = await getCollection('apps');

  const docs: SearchDoc[] = apps.map((app) => ({
    slug: app.id,
    name: app.data.name,
    tags: app.data.tags,
    summaryEn: app.data.summary.en,
    summaryVi: app.data.summary.vi,
  }));

  // Display data is deliberately NOT stored in the index — it is already in
  // the DOM (docs/05 §A3), and storing it again would double the payload the
  // client downloads on first search.
  return new Response(JSON.stringify(buildIndex(docs)), {
    headers: { 'Content-Type': 'application/json' },
  });
};
