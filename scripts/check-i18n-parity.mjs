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
/** Locale dictionaries only — `xx.json` or `xx-YY.json`, never helper files. */
const LOCALE_FILE = /^([a-z]{2}(?:-[A-Z]{2})?)\.json$/;
const PLACEHOLDER = /\{(\w+)\}/g;

/** Plain UTF-16 order — identical to the default sort, but explicit (S2871). */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Dot-flatten so nested objects can never hide a missing leaf. An EMPTY object
 * or array is reported as its own key, otherwise `"x": {}` flattens to nothing
 * and a locale could carry it unnoticed.
 */
function flatten(value, prefix = '') {
  if (value === null || typeof value !== 'object') return [[prefix, value]];
  const entries = Object.entries(value);
  if (entries.length === 0) return [[prefix, value]];
  return entries.flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

const errors = [];

function load(lang) {
  const file = join(root, `${lang}.json`);
  // Windows editors like to prepend a UTF-8 BOM, which JSON.parse rejects
  // with a stack trace instead of a readable gate failure.
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  try {
    return new Map(flatten(JSON.parse(text)));
  } catch (err) {
    errors.push(`${lang}.json → not valid JSON (${err.message})`);
    return new Map();
  }
}

const placeholders = (s) =>
  typeof s === 'string' ? [...s.matchAll(PLACEHOLDER)].map((m) => m[1]).sort(byCodeUnit) : [];

const locales = readdirSync(root)
  .map((f) => LOCALE_FILE.exec(f)?.[1])
  .filter(Boolean);

const dicts = new Map(locales.map((lang) => [lang, load(lang)]));
const base = dicts.get(BASE) ?? new Map();

for (const lang of locales.filter((l) => l !== BASE)) {
  const dict = dicts.get(lang);
  for (const [k, v] of base) {
    if (!dict.has(k)) {
      errors.push(`${lang}.json → missing "${k}"`);
      continue;
    }
    // `t()` substitutes {name} placeholders (src/i18n/index.ts); a translation
    // that drops or renames one renders the literal braces to the visitor.
    const want = placeholders(v).join(',');
    const got = placeholders(dict.get(k)).join(',');
    if (want !== got) errors.push(`${lang}.json → "${k}" placeholders {${got}} ≠ en {${want}}`);
  }
  for (const k of dict.keys()) if (!base.has(k)) errors.push(`${lang}.json → extra "${k}"`);
}

// Alphabetical order is a review aid, not cosmetics: it keeps diffs of a
// large dictionary readable (docs/07 §3).
for (const [lang, dict] of dicts) {
  const keys = [...dict.keys()];
  const sorted = [...keys].sort(byCodeUnit);
  const at = keys.findIndex((k, i) => k !== sorted[i]);
  if (at !== -1) errors.push(`${lang}.json → keys not alphabetised (first: "${keys[at]}")`);
}

if (errors.length > 0) {
  console.error(`i18n:check — ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exitCode = 1;
} else {
  console.log(`i18n:check — OK (${base.size} keys × ${locales.length} locales)`);
}
