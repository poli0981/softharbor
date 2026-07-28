// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Emits every official URL in the dataset, one per line, for lychee
 * (docs/12 §5). L3 of the validation stack.
 *
 *   node scripts/extract-urls.mjs            → all entries (weekly sweep)
 *   node scripts/extract-urls.mjs --changed  → only files changed vs origin/main
 *
 * The --changed mode keeps PR feedback fast; the weekly job owns the full run.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const APPS_DIR = join(process.cwd(), 'src/data/apps');
const changedOnly = process.argv.includes('--changed');

let files = existsSync(APPS_DIR) ? readdirSync(APPS_DIR).filter((f) => f.endsWith('.json')) : [];

if (changedOnly) {
  try {
    const diff = execSync('git diff --name-only origin/main...HEAD -- src/data/apps', {
      encoding: 'utf8',
    });
    const changed = new Set(
      diff
        .split('\n')
        .map((l) => l.trim().split('/').pop())
        .filter(Boolean),
    );
    files = files.filter((f) => changed.has(f));
  } catch {
    // No origin/main (fresh clone, detached CI checkout): fall back to the
    // full set rather than silently checking nothing.
    console.error('extract-urls: could not diff against origin/main, using all entries');
  }
}

const urls = new Set();
for (const file of files) {
  const app = JSON.parse(readFileSync(join(APPS_DIR, file), 'utf8'));
  for (const v of Object.values(app.links ?? {})) if (v) urls.add(v);
  if (app.security?.evidence) urls.add(app.security.evidence);
}

for (const u of [...urls].sort()) console.log(u);
