// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * L2 data validation (docs/03 §2). Catches what the Zod schema structurally
 * cannot: rules that span files, or that involve the filename, or the
 * filesystem.
 *
 * Plain Node — runs OUTSIDE Astro, so it must never import astro:content.
 * Prints `file → rule → detail` and exits non-zero.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const APPS_DIR = join(process.cwd(), 'src/data/apps');
const QUARANTINE_DIR = join(process.cwd(), 'data/quarantine');
const LOGOS_DIR = join(process.cwd(), 'src/assets/logos');
const CATEGORIES = join(process.cwd(), 'src/data/categories.json');

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX = 40;
/** Workers Static Assets caps a deploy; warn well before it (docs/08 A5). */
const FILE_WARN_THRESHOLD = 15_000;

const errors = [];
const warnings = [];
const fail = (file, rule, detail) => errors.push({ file, rule, detail });

/** Same fold as src/lib/normalize.ts — duplicated only because this script
 *  runs in plain Node and must not import from src/ (kept in sync by test). */
const normalizeViet = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const categoryIds = new Set(JSON.parse(readFileSync(CATEGORIES, 'utf8')).map((c) => c.id));

const files = existsSync(APPS_DIR) ? readdirSync(APPS_DIR).filter((f) => f.endsWith('.json')) : [];

const seenSlug = new Map();
const seenName = new Map();

for (const file of files) {
  const slug = file.replace(/\.json$/, '');
  let app;
  try {
    app = JSON.parse(readFileSync(join(APPS_DIR, file), 'utf8'));
  } catch (e) {
    fail(file, 'parse', e.message);
    continue;
  }

  // Zod never sees the filename, but the filename IS the slug — it is the URL
  // and the RSS guid (docs/04 §2).
  if (!SLUG_RE.test(slug)) fail(file, 'slug-format', `"${slug}" is not kebab-case [a-z0-9-]`);
  if (slug.length > SLUG_MAX) fail(file, 'slug-length', `${slug.length} chars, max ${SLUG_MAX}`);
  if (seenSlug.has(slug)) fail(file, 'duplicate-slug', `also ${seenSlug.get(slug)}`);
  seenSlug.set(slug, file);

  // Two entries for the same product, differing only by accent or case, is a
  // curation error a human reviewer reliably misses.
  if (typeof app.name === 'string') {
    const key = normalizeViet(app.name);
    if (seenName.has(key))
      fail(file, 'duplicate-name', `"${app.name}" collides with ${seenName.get(key)}`);
    seenName.set(key, file);
  }

  for (const id of app.categories ?? []) {
    if (!categoryIds.has(id)) fail(file, 'unknown-category', `"${id}" not in categories.json`);
  }

  for (const [k, v] of Object.entries(app.links ?? {})) {
    if (v !== null && !String(v).startsWith('https://'))
      fail(file, 'insecure-link', `links.${k} = ${v}`);
  }

  // Hard rule 5: a flagged entry must be in data/quarantine/, never here.
  if (app.security?.status === 'flagged') {
    fail(file, 'flagged-in-main-tree', 'move to data/quarantine/ (docs/03 §5)');
  }

  // A local: logo that does not exist fails the build far away from the cause.
  const local = /^local:(.+)$/.exec(app.logo ?? '');
  if (local && !existsSync(join(LOGOS_DIR, local[1]))) {
    fail(file, 'missing-logo', `src/assets/logos/${local[1]} not found`);
  }

  if (app.updatedAt && app.addedAt && app.updatedAt < app.addedAt) {
    fail(file, 'date-order', `updatedAt ${app.updatedAt} precedes addedAt ${app.addedAt}`);
  }
}

// Quarantined entries must keep status flagged, or restoring them silently
// republishes something that was pulled.
if (existsSync(QUARANTINE_DIR)) {
  for (const file of readdirSync(QUARANTINE_DIR).filter((f) => f.endsWith('.json'))) {
    try {
      const q = JSON.parse(readFileSync(join(QUARANTINE_DIR, file), 'utf8'));
      if (q.security?.status !== 'flagged') {
        fail(
          `data/quarantine/${file}`,
          'unflagged-in-quarantine',
          `status is "${q.security?.status}"`,
        );
      }
      if (seenSlug.has(file.replace(/\.json$/, ''))) {
        fail(`data/quarantine/${file}`, 'slug-in-both-trees', 'same slug is live and quarantined');
      }
    } catch (e) {
      fail(`data/quarantine/${file}`, 'parse', e.message);
    }
  }
}

if (files.length > FILE_WARN_THRESHOLD) {
  warnings.push(`${files.length} app files — approaching the Workers per-deploy cap (docs/08 A5)`);
}

for (const w of warnings) console.warn(`  ! ${w}`);

if (errors.length > 0) {
  console.error(`validate:data — ${errors.length} problem(s):\n`);
  const w = Math.max(...errors.map((e) => e.file.length));
  for (const e of errors)
    console.error(`  ✗ ${e.file.padEnd(w)}  ${e.rule.padEnd(22)}  ${e.detail}`);
  process.exitCode = 1;
} else {
  console.log(`validate:data — OK (${files.length} apps, ${categoryIds.size} categories)`);
}
