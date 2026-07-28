// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/03 §7, docs/05 §A4 — the announcement feed.
//
// `notify.py` consumes this on a cron in its own repo and posts new items to
// Telegram / Discord / Bluesky / Mastodon / X / Facebook. That makes byte
// determinism a contract, not a nicety: a redeploy with no data change must
// produce an identical feed, or the cross-poster re-announces old apps.

import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { feedItems } from '../lib/feed';

/** Minimal XML text escape for the one value we inject by hand. */
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET(context: APIContext) {
  const site = context.site?.href ?? 'https://softharbor.net';
  const apps = await getCollection('apps');

  const items = feedItems(
    apps.map((app) => ({
      slug: app.id,
      name: app.data.name,
      summaryEn: app.data.summary.en,
      addedAt: app.data.addedAt,
    })),
    site,
  );

  return rss({
    title: 'SoftHarbor',
    description: 'Free & buy-once desktop software, one page.',
    site,
    // No channel-level lastBuildDate or pubDate: either would change on every
    // build and break the determinism above.
    items: items.map((i) => ({
      title: i.title,
      link: i.link,
      description: i.description,
      pubDate: i.pubDate,
      // @astrojs/rss has no `guid` option — it derives <guid> from `link`.
      // docs/05 §A4 wants the bare slug with isPermaLink="false", because the
      // slug is permanent while a URL is only conventionally so. Injected via
      // customData; the emitted XML is asserted in the build check.
      customData: `<guid isPermaLink="false">${xml(i.guid)}</guid>`,
    })),
  });
}
