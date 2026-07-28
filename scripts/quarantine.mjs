// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Quarantine sweep — docs/03 §5, docs/12 §4. Enforces hard rule 5
 * mechanically: a flagged entry never survives in the live tree.
 *
 * Moves every `src/data/apps/*.json` with security.status === "flagged" into
 * `data/quarantine/`, which sits OUTSIDE the content glob, so the entry stops
 * rendering on the next build.
 *
 * MOVE, never delete: the file keeps its schema so restoring is a plain
 * `git mv` plus a status edit, and the reason lives in the tracking issue and
 * the commit message. History is the audit trail.
 *
 * Idempotent; exits 0 when there is nothing to do. Writes the moved slugs to
 * the `moved` GitHub output so the workflow can open a PR and one issue each.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';

const APPS_DIR = join(process.cwd(), 'src/data/apps');
const QUARANTINE_DIR = join(process.cwd(), 'data/quarantine');

const moved = [];

if (existsSync(APPS_DIR)) {
  for (const file of readdirSync(APPS_DIR).filter((f) => f.endsWith('.json'))) {
    const path = join(APPS_DIR, file);
    let app;
    try {
      app = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      // A malformed file is L1/L2's problem, not ours — never move blindly.
      console.error(`quarantine: skipping unparseable ${file}: ${e.message}`);
      continue;
    }
    if (app?.security?.status !== 'flagged') continue;

    mkdirSync(QUARANTINE_DIR, { recursive: true });
    const dest = join(QUARANTINE_DIR, file);
    if (existsSync(dest)) {
      console.error(`quarantine: ${file} already in quarantine — leaving both for review`);
      continue;
    }
    renameSync(path, dest);
    moved.push(file.replace(/\.json$/, ''));
    console.log(`quarantine: moved ${file} → data/quarantine/`);
  }
}

if (moved.length === 0) console.log('quarantine: nothing flagged');

// Space-separated, consumed by .github/workflows/quarantine.yml.
if (process.env['GITHUB_OUTPUT']) {
  appendFileSync(process.env['GITHUB_OUTPUT'], `moved=${moved.join(' ')}\n`);
}
