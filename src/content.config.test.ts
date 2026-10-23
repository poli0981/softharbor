// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Validation layer L1 (docs/03 §2): the Zod rules in src/content.config.ts.
// Astro's content runtime is stubbed — `defineCollection` hands the config
// back, `reference()` becomes a plain id — so what runs here is exactly our
// schema; resolving references against categories.json stays the build's job.

import { z } from 'astro/zod';
import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  defineCollection: (config: unknown) => config,
  reference: () => z.string(),
}));
vi.mock('astro/loaders', () => ({
  glob: (options: unknown) => ({ kind: 'glob', options }),
  file: (path: string) => ({ kind: 'file', path }),
}));

const { collections } = await import('./content.config');

interface Schema {
  safeParse(input: unknown): { success: boolean; error?: { issues: Array<{ path: unknown[] }> } };
}
const apps = collections.apps as unknown as { schema: Schema; loader: unknown };
const categories = collections.categories as unknown as { schema: Schema; loader: unknown };

const TODAY = new Date().toISOString().slice(0, 10);

function app(overrides: Record<string, unknown> = {}) {
  return {
    name: '7-Zip',
    developer: 'Igor Pavlov',
    logo: 'simple-icons:7zip',
    summary: {
      en: 'File archiver with a high compression ratio.',
      vi: 'Trình nén tệp với tỷ lệ nén cao.',
    },
    categories: ['file-management'],
    tags: ['archiver'],
    platforms: ['windows'],
    pricing: 'free',
    license: 'LGPL-2.1-or-later',
    links: {
      homepage: 'https://www.7-zip.org',
      repo: null,
      download: 'https://www.7-zip.org/download.html',
    },
    security: {
      status: 'clean',
      evidence: 'https://www.virustotal.com/gui/url/abc',
      checkedAt: '2026-07-30',
    },
    addedAt: '2026-07-28',
    ...overrides,
  };
}

/** The distinct paths of every issue, joined, e.g. ["security.evidence"]. */
function issues(input: unknown): string[] {
  const r = apps.schema.safeParse(input);
  return r.success ? [] : [...new Set((r.error?.issues ?? []).map((i) => i.path.join('.')))];
}

describe('collection wiring', () => {
  it('loads apps from one JSON file per slug and categories from the registry', () => {
    expect(apps.loader).toEqual({
      kind: 'glob',
      options: { pattern: '*.json', base: './src/data/apps' },
    });
    expect(categories.loader).toEqual({ kind: 'file', path: './src/data/categories.json' });
  });

  it('accepts a registry row and rejects a bad id', () => {
    const row = {
      id: 'ai-local',
      label: { en: 'Local AI', vi: 'AI cục bộ' },
      icon: 'bot',
      order: 1,
    };
    expect(categories.schema.safeParse(row).success).toBe(true);
    expect(categories.schema.safeParse({ ...row, id: 'AI Local' }).success).toBe(false);
  });
});

describe('apps schema (L1)', () => {
  it('accepts a complete entry', () => {
    expect(issues(app())).toEqual([]);
  });

  it('rejects unknown keys, so the export contract cannot silently grow', () => {
    expect(issues(app({ rating: 5 }))).toEqual(['']);
  });

  it('accepts only the three logo forms', () => {
    for (const logo of ['simple-icons:7zip', 'local:seven-zip.svg', 'monogram']) {
      expect(issues(app({ logo }))).toEqual([]);
    }
    for (const logo of ['simple-icons:7-Zip', 'local:logo.png', 'https://x.test/a.svg']) {
      expect(issues(app({ logo }))).toEqual(['logo']);
    }
  });

  it('bounds summaries, categories, tags and platforms', () => {
    expect(
      issues(app({ summary: { en: 'too short', vi: 'Trình nén tệp với tỷ lệ nén cao.' } })),
    ).toEqual(['summary.en']);
    expect(issues(app({ categories: [] }))).toEqual(['categories']);
    expect(issues(app({ categories: ['a', 'b', 'c', 'd'] }))).toEqual(['categories']);
    expect(issues(app({ tags: ['Not Kebab'] }))).toEqual(['tags.0']);
    expect(issues(app({ tags: Array.from({ length: 9 }, (_, i) => `t${i}`) }))).toEqual(['tags']);
    expect(issues(app({ platforms: [] }))).toEqual(['platforms']);
    expect(issues(app({ platforms: ['android'] }))).toEqual(['platforms.0']);
  });

  it('defaults tags to an empty list', () => {
    const entry: Record<string, unknown> = app();
    Reflect.deleteProperty(entry, 'tags');
    const r = apps.schema.safeParse(entry) as { success: boolean; data?: { tags: string[] } };
    expect(r.success).toBe(true);
    expect(r.data?.tags).toEqual([]);
  });

  it('allows only the three pricing buckets (hard rule 3)', () => {
    expect(issues(app({ pricing: 'onetime' }))).toEqual([]);
    expect(issues(app({ pricing: 'subscription' }))).toEqual(['pricing']);
  });

  it('wants https links, a nullable repo, and no http anywhere', () => {
    const links = app().links;
    expect(issues(app({ links: { ...links, repo: 'https://github.com/ip7z/7zip' } }))).toEqual([]);
    expect(issues(app({ links: { ...links, homepage: 'http://www.7-zip.org' } }))).toEqual([
      'links.homepage',
    ]);
    expect(issues(app({ links: { ...links, download: 'not a url' } }))).toEqual(['links.download']);
  });

  it('requires evidence for a status that claims something (hard rule 4)', () => {
    const security = app().security;
    for (const status of ['clean', 'flagged']) {
      expect(issues(app({ security: { ...security, status, evidence: null } }))).toEqual([
        'security.evidence',
      ]);
    }
    expect(
      issues(app({ security: { ...security, status: 'unverified', evidence: null } })),
    ).toEqual([]);
    expect(issues(app({ security: { ...security, status: 'safe' } }))).toEqual(['security.status']);
  });

  it('takes only real, past calendar dates', () => {
    const security = app().security;
    expect(issues(app({ addedAt: '2026-02-31' }))).toEqual(['addedAt']);
    expect(issues(app({ addedAt: '28/07/2026' }))).toEqual(['addedAt']);
    expect(issues(app({ addedAt: '2999-01-01' }))).toEqual(['addedAt']);
    expect(issues(app({ security: { ...security, checkedAt: TODAY } }))).toEqual([]);
  });

  it('keeps updatedAt on or after addedAt', () => {
    expect(issues(app({ updatedAt: '2026-07-28' }))).toEqual([]);
    expect(issues(app({ updatedAt: '2026-07-01' }))).toEqual(['updatedAt']);
  });
});
