// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Test kit for the build scripts. Every script resolves its inputs from
// process.cwd() (dist/, src/i18n/, src/data/…), so a test writes a throwaway
// project tree and runs the REAL script in it as a child process — the same
// way `pnpm build` and CI invoke it, exit code and all.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onTestFinished } from 'vitest';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));

/** A temporary project root holding `files` (path → contents), removed after the test. */
export function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'sh-script-'));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  write(root, files);
  return root;
}

export function write(root: string, files: Record<string, string>): void {
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
}

export interface Run {
  code: number | null;
  stdout: string;
  /** stdout + stderr, for assertions that do not care which stream. */
  out: string;
}

export function run(
  script: string,
  root: string,
  opts: { args?: string[]; input?: string; env?: Record<string, string> } = {},
): Run {
  // Never inherit GITHUB_OUTPUT: under Actions, quarantine.mjs would append to
  // the CI job's real output file.
  const env = { ...process.env };
  Reflect.deleteProperty(env, 'GITHUB_OUTPUT');
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...(opts.args ?? [])], {
    cwd: root,
    input: opts.input ?? '',
    encoding: 'utf8',
    env: { ...env, ...opts.env },
  });
  return { code: r.status, stdout: r.stdout, out: r.stdout + r.stderr };
}
