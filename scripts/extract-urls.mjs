// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Emits every official URL in the dataset, one per line, for lychee
 * (docs/12 §5). L3 of the validation stack.
 *
 *   node scripts/extract-urls.mjs            → all entries (weekly sweep)
 *   git diff -U0 … | node scripts/extract-urls.mjs --added
 *                                            → only URLs on lines the diff adds
 *
 * The --added mode keeps PR feedback fast and about the PR: a link a pull
 * request adds or edits is checked, a link it merely sits next to is not.
 * Checking every link of every touched file (the old --changed mode) made a
 * re-check PR that rewrote 198 security blocks re-verify ~700 unrelated
 * vendor links, and any one vendor's bad minute (a 520, a 522, a timeout)
 * blocked it. The weekly job still owns the full run.
 *
 * The diff arrives on stdin rather than from a `git diff` spawned here.
 * Spawning `git` meant resolving it through PATH (SonarCloud S4036), and a
 * catch-all fallback would turn ANY git failure into a silent full sweep. The
 * workflow runs git itself under `set -euo pipefail`, so a broken diff fails
 * loudly where it happens.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const APPS_DIR = join(process.cwd(), 'src/data/apps');

/** Plain UTF-16 order — identical to the default sort, but explicit (S2871). */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const urls = new Set();

if (process.argv.includes('--added')) {
  // Unified diff: an added line starts with "+", the file header with "+++".
  for (const line of readFileSync(0, 'utf8').split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    for (const [, url] of line.matchAll(/"(https:\/\/[^"\s]+)"/g)) urls.add(url);
  }
} else {
  const files = existsSync(APPS_DIR)
    ? readdirSync(APPS_DIR).filter((f) => f.endsWith('.json'))
    : [];
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
}

for (const u of [...urls].sort(byCodeUnit)) console.log(u);
