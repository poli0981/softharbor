// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/04 §1 — the single source of truth. Everything else (pages, indexes,
// exports, feed) is derived. Schema version: 1.
//
// This is validation layer L1: it runs inside `astro build`, so invalid data
// fails the build (hard rule 2). Cross-file rules Zod cannot see live in L2,
// scripts/validate-data.mjs (docs/03 §2).

import { defineCollection, reference, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const HTTPS = z.string().url().startsWith('https://');

const categories = defineCollection({
  loader: file('./src/data/categories.json'),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.object({ en: z.string(), vi: z.string() }),
    icon: z.string(), // lucide icon name, e.g. "globe"
    order: z.number().int(),
  }),
});

const apps = defineCollection({
  // id = filename = slug (docs/04 §2)
  loader: glob({ pattern: '*.json', base: './src/data/apps' }),
  schema: z
    .object({
      name: z.string().min(1).max(60),
      developer: z.string().min(1).max(80),
      // `monogram` = no brand mark is available for this app (D23). The
      // `webp` alternative is gone: the render path inlines SVG, so a raster
      // logo would need an `<img>` and Astro asset handling that nothing asks
      // for yet — better absent than declared-but-unimplemented.
      logo: z.string().regex(/^(simple-icons:[a-z0-9]+|local:[a-z0-9-]+\.svg|monogram)$/),
      summary: z.object({
        en: z.string().min(20).max(160),
        vi: z.string().min(20).max(160),
      }),
      categories: z.array(reference('categories')).min(1).max(3),
      tags: z
        .array(z.string().regex(/^[a-z0-9-]+$/))
        .max(8)
        .default([]),
      platforms: z.array(z.enum(['windows', 'macos', 'linux'])).min(1),
      pricing: z.enum(['free', 'free-onetime', 'onetime']),
      license: z.string().min(2).nullable(), // SPDX id, or null = closed source
      links: z.object({
        homepage: HTTPS,
        repo: HTTPS.nullable(),
        download: HTTPS,
      }),
      security: z.object({
        status: z.enum(['clean', 'flagged', 'unverified']),
        evidence: HTTPS.nullable(), // VirusTotal / vendor advisory
        checkedAt: DATE,
      }),
      addedAt: DATE,
      updatedAt: DATE.optional(),
    })
    // Deliberate: unknown keys fail the build, so the public export contract
    // (docs/03 §6) can never silently grow.
    .strict(),
});

export const collections = { apps, categories };
