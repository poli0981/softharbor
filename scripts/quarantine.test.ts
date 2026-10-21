// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// quarantine.mjs (hard rule 5: move, never delete) and extract-urls.mjs (the
// lychee feed) — the two scripts the scheduled workflows run.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { project, run } from './fixture';

const entry = (status: string, links: Record<string, string | null> = {}, evidence?: string) =>
  JSON.stringify({ name: 'X', links, security: { status, evidence } });

describe('quarantine', () => {
  it('moves flagged entries out of the content tree and reports them to the workflow', () => {
    const root = project({
      'src/data/apps/bad-app.json': entry('flagged'),
      'src/data/apps/good-app.json': entry('clean'),
      'src/data/apps/broken.json': '{ nope',
    });
    const r = run('quarantine.mjs', root, { env: { GITHUB_OUTPUT: join(root, 'out.txt') } });

    expect(r.code).toBe(0);
    expect(r.out).toContain('moved bad-app.json → data/quarantine/');
    expect(r.out).toContain('skipping unparseable broken.json');
    expect(existsSync(join(root, 'src/data/apps/bad-app.json'))).toBe(false);
    expect(readFileSync(join(root, 'data/quarantine/bad-app.json'), 'utf8')).toBe(entry('flagged'));
    expect(existsSync(join(root, 'src/data/apps/good-app.json'))).toBe(true);
    expect(readFileSync(join(root, 'out.txt'), 'utf8')).toBe('moved=bad-app\n');
  });

  it('is idempotent, and reports an empty move list', () => {
    const root = project({ 'src/data/apps/good-app.json': entry('clean') });
    const r = run('quarantine.mjs', root, { env: { GITHUB_OUTPUT: join(root, 'out.txt') } });
    expect(r.out).toContain('nothing flagged');
    expect(readFileSync(join(root, 'out.txt'), 'utf8')).toBe('moved=\n');
  });

  it('never overwrites a quarantined file, and never moves a malformed slug', () => {
    const root = project({
      'src/data/apps/twice.json': entry('flagged'),
      'data/quarantine/twice.json': entry('flagged', { homepage: 'https://old.test/' }),
      'src/data/apps/Not A Slug.json': entry('flagged'),
    });
    const r = run('quarantine.mjs', root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('twice.json already in quarantine — leaving both for review');
    expect(r.out).toContain('refusing to move Not A Slug.json');
    expect(existsSync(join(root, 'src/data/apps/twice.json'))).toBe(true);
    expect(readFileSync(join(root, 'data/quarantine/twice.json'), 'utf8')).toContain('old.test');
  });
});

describe('extract-urls', () => {
  const apps = {
    'src/data/apps/a.json': entry(
      'clean',
      { homepage: 'https://b.test/', repo: null },
      'https://vt.test/a',
    ),
    'src/data/apps/b.json': entry('clean', {
      homepage: 'https://a.test/',
      download: 'https://b.test/',
    }),
  };

  it('prints every official URL once, sorted', () => {
    const r = run('extract-urls.mjs', project(apps));
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('https://a.test/\nhttps://b.test/\nhttps://vt.test/a\n');
  });

  it('limits itself to the files named on stdin with --changed', () => {
    const r = run('extract-urls.mjs', project(apps), {
      args: ['--changed'],
      input: 'src/data/apps/b.json\nREADME.md\n',
    });
    expect(r.stdout).toBe('https://a.test/\nhttps://b.test/\n');
  });

  it('keeps going past a malformed file, but fails the run', () => {
    const root = project({ ...apps, 'src/data/apps/c.json': '{' });
    const r = run('extract-urls.mjs', root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('skipping c.json');
    expect(r.stdout).toContain('https://vt.test/a');
  });
});
