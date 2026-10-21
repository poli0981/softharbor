// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/03 §6/§7, docs/05 §A4 — the two public data outputs.
//
// Pure functions over plain objects so the contracts that matter (feed
// determinism, export shape) are unit-testable without running a build.

export interface FeedApp {
  slug: string;
  name: string;
  summaryEn: string;
  addedAt: string;
}

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  guid: string;
}

export const FEED_LIMIT = 50;

/**
 * Name tie-break with a PINNED locale. A bare `localeCompare()` collates by
 * the build machine's ICU default — and builds now run on Cloudflare Workers
 * Builds as well as GitHub CI and laptops. If two machines disagreed, the
 * 50-item window could change membership between builds and notify.py would
 * announce apps that are not new. `en` matches the order production has
 * served since launch (verified byte-for-byte against the live /rss.xml).
 */
const byName = new Intl.Collator('en');

/**
 * Newest first, capped at 50.
 *
 * The tiebreak on name is not cosmetic: `notify.py` consumes this feed on a
 * cron and re-announces anything it sees as new, so the ordering has to be a
 * function of the DATA alone. Two entries added the same day must not swap
 * places between builds (docs/13 §5).
 */
export function feedItems(apps: readonly FeedApp[], site: string): FeedItem[] {
  return [...apps]
    .sort(
      (a, b) =>
        (b.addedAt < a.addedAt ? -1 : b.addedAt > a.addedAt ? 1 : 0) ||
        byName.compare(a.name, b.name),
    )
    .slice(0, FEED_LIMIT)
    .map((app) => ({
      title: app.name,
      link: new URL(`/apps/${app.slug}`, site).href,
      description: app.summaryEn,
      // Midnight UTC of addedAt — never "now", or every redeploy would look
      // like new content.
      pubDate: new Date(`${app.addedAt}T00:00:00Z`),
      // Stable and permanent: the slug never changes once shipped
      // (docs/04 §2), which is what stops re-announcements.
      guid: app.slug,
    }));
}

export interface ExportApp extends Record<string, unknown> {
  slug: string;
}

/** docs/03 §6 — the frozen public contract. */
export function buildExport(apps: readonly ExportApp[], generatedAt: string) {
  return {
    // Integer, not `$schema`: that key conventionally holds a URI, and this is
    // a contract we have to live with (docs/03 §6).
    schemaVersion: 1,
    generatedAt,
    count: apps.length,
    license: 'CC-BY-SA-4.0',
    attribution: 'SoftHarbor contributors — https://github.com/poli0981/softharbor',
    // Code-unit order: slugs are ASCII kebab-case, where it matches `en`
    // collation exactly — without depending on the build machine's ICU
    // default the way a bare localeCompare() did.
    apps: [...apps].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
  };
}
