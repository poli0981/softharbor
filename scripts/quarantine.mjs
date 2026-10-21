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
 * move back plus a status edit, and the reason lives in the tracking issue and
 * the commit message. History is the audit trail. (A plain filesystem rename;
 * git records it as a rename when the move is committed.)
 *
 * Two callers:
 *  - a maintainer, locally: set `security.status` to "flagged", run
 *    `pnpm quarantine`, commit both the flag and the move in one PR — the
 *    `gates` check (validate:data) rejects a flagged entry left in place;
 *  - .github/workflows/quarantine.yml, nightly and on data pushes, as the
 *    safety net. It reads the moved slugs from the `moved` GitHub output.
 *
 * Idempotent; exits 0 when there is nothing to do.
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

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
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
    const slug = file.replace(/\.json$/, '');
    // The slug reaches a workflow output, a commit message and an issue title;
    // anything that is not a plain kebab-case slug is left for a human.
    if (!SLUG_RE.test(slug)) {
      console.error(`quarantine: refusing to move ${file} — not a valid slug`);
      process.exitCode = 1;
      continue;
    }
    renameSync(path, dest);
    moved.push(slug);
    console.log(`quarantine: moved ${file} → data/quarantine/`);
  }
}

if (moved.length === 0) console.log('quarantine: nothing flagged');

// Space-separated, consumed by .github/workflows/quarantine.yml.
if (process.env['GITHUB_OUTPUT']) {
  appendFileSync(process.env['GITHUB_OUTPUT'], `moved=${moved.join(' ')}\n`);
}
