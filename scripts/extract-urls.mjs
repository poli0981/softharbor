// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Emits every official URL in the dataset, one per line, for lychee
 * (docs/12 §5). L3 of the validation stack.
 *
 *   node scripts/extract-urls.mjs            → all entries (weekly sweep)
 *   git diff --name-only … | node scripts/extract-urls.mjs --changed
 *                                            → only the files named on stdin
 *
 * The --changed mode keeps PR feedback fast; the weekly job owns the full run.
 *
 * The changed-file list arrives on stdin rather than from a `git diff` spawned
 * here. Spawning `git` meant resolving it through PATH (SonarCloud S4036), and
 * the old catch-all fallback turned ANY git failure into a silent full sweep of
 * ~1 150 URLs. The workflow now runs git itself under `set -euo pipefail`, so a
 * broken diff fails loudly where it happens.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const APPS_DIR = join(process.cwd(), 'src/data/apps');
const changedOnly = process.argv.includes('--changed');

/** Plain UTF-16 order — identical to the default sort, but explicit (S2871). */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

let files = existsSync(APPS_DIR) ? readdirSync(APPS_DIR).filter((f) => f.endsWith('.json')) : [];

if (changedOnly) {
  const changed = new Set(
    readFileSync(0, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((p) => basename(p)),
  );
  files = files.filter((f) => changed.has(f));
}

const urls = new Set();
for (const file of files) {
  let app;
  try {
    app = JSON.parse(readFileSync(join(APPS_DIR, file), 'utf8'));
  } catch (err) {
    // validate:data reports malformed JSON with context; here it must not
    // abort the whole sweep, but it must not pass unnoticed either.
    console.error(`extract-urls: skipping ${file} (${err.message})`);
    process.exitCode = 1;
    continue;
  }
  for (const v of Object.values(app.links ?? {})) if (v) urls.add(v);
  if (app.security?.evidence) urls.add(app.security.evidence);
}

for (const u of [...urls].sort(byCodeUnit)) console.log(u);
