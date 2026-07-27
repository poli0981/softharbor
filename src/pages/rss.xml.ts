// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// S1 probe: proves @astrojs/rss emits a route in a static build. The real
// feed (50 newest by addedAt, guid = slug, no lastBuildDate) lands in M5 —
// docs/03 §7, docs/05 §A4.
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

export function GET(context: APIContext) {
  return rss({
    title: 'SoftHarbor',
    description: 'Free & buy-once desktop software, one page.',
    site: context.site ?? 'https://softharbor.net',
    items: [],
  });
}
