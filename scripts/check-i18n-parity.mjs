// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * i18n key-parity gate (docs/07 §3, hard rule 6): every locale mirrors the
 * English key set 1:1. English is the source of truth.
 *
 * Its own script, NOT folded into validate-data.mjs, because that one is
 * triggered by src/data/** — an edit touching only src/i18n/*.json would then
 * skip the very check it needs (docs/07 §3).
 *
 * Plain Node: no astro:content, no deps.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'src/i18n');
const BASE = 'en';

/** Dot-flatten so nested objects can never hide a missing leaf. */
function flatten(value, prefix = '') {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

const keysFor = (lang) =>
  new Set(flatten(JSON.parse(readFileSync(join(root, `${lang}.json`), 'utf8'))));

const locales = readdirSync(root)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

const baseKeys = keysFor(BASE);
const errors = [];

for (const lang of locales.filter((l) => l !== BASE)) {
  const langKeys = keysFor(lang);
  for (const k of baseKeys) if (!langKeys.has(k)) errors.push(`${lang}.json → missing "${k}"`);
  for (const k of langKeys) if (!baseKeys.has(k)) errors.push(`${lang}.json → extra "${k}"`);
}

// Alphabetical order is a review aid, not cosmetics: it keeps diffs of a
// 200-key dictionary readable (docs/07 §3).
for (const lang of locales) {
  const keys = [...keysFor(lang)];
  const sorted = [...keys].sort();
  const at = keys.findIndex((k, i) => k !== sorted[i]);
  if (at !== -1) errors.push(`${lang}.json → keys not alphabetised (first: "${keys[at]}")`);
}

if (errors.length > 0) {
  console.error(`i18n:check — ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exitCode = 1;
} else {
  console.log(`i18n:check — OK (${baseKeys.size} keys × ${locales.length} locales)`);
}
