// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/04 §1 — the single source of truth. Everything else (pages, indexes,
// exports, feed) is derived. Schema version: 1.
//
// This is validation layer L1: it runs inside `astro build`, so invalid data
// fails the build (hard rule 2). Cross-file rules Zod cannot see live in L2,
// scripts/validate-data.mjs (docs/03 §2).

import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
// `z` from 'astro:content' is deprecated and goes away in Astro 8.
import { z } from 'astro/zod';

/** Today in UTC, at build time: data dated after the build is a typo. */
const TODAY = new Date().toISOString().slice(0, 10);

/**
 * A real calendar date in YYYY-MM-DD, not in the future. The regex alone let
 * `2026-02-31` through; round-tripping through Date catches impossible days.
 * Zod runs this refinement even after the regex failed, and an unparseable
 * string makes `toISOString()` THROW — which crashed the build with a bare
 * RangeError instead of naming the field — so the NaN case is answered first.
 */
const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
  .refine(
    (d) => {
      const t = Date.parse(`${d}T00:00:00Z`);
      return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
    },
    { message: 'not a real calendar date' },
  )
  .refine((d) => d <= TODAY, { message: 'date is in the future' });
const HTTPS = z.url().refine((u) => u.startsWith('https://'), { message: 'https:// only' });

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
    .strict()
    .superRefine((app, ctx) => {
      // A status that makes a claim must link the evidence behind it: "no
      // known warnings" is only worth something when the reader can check
      // it (hard rule 4), and a flag needs its reason. CONTRIBUTING closed
      // these on sight, but nothing enforced it. `unverified` claims nothing.
      if (app.security.status !== 'unverified' && app.security.evidence === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['security', 'evidence'],
          message: `status "${app.security.status}" requires an evidence URL`,
        });
      }
      if (app.updatedAt && app.updatedAt < app.addedAt) {
        ctx.addIssue({
          code: 'custom',
          path: ['updatedAt'],
          message: `updatedAt ${app.updatedAt} precedes addedAt ${app.addedAt}`,
        });
      }
    }),
});

export const collections = { apps, categories };
