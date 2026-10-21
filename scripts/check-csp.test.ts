// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// check-csp.mjs and postbuild.mjs together: postbuild puts the policy first,
// check-csp proves every page's markup is allowed by its own policy. Plus
// check-assets.mjs, the other guard over dist/ HTML.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { project, run } from './fixture';

const sha = (s: string): string => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;
const CHARSET = '<meta charset="utf-8">';
const meta = (policy: string): string =>
  `<meta http-equiv="content-security-policy" content="${policy}">`;
const page = (policy: string, head = '', body = ''): string =>
  `<!doctype html><html><head>${CHARSET}${meta(policy)}${head}</head><body>${body}</body></html>`;

describe('check-csp', () => {
  it('passes a page whose inline style and script are hashed', () => {
    const css = 'a{color:red}';
    const js = 'console.log(1)';
    const root = project({
      'dist/index.html': page(
        `script-src 'self' ${sha(js)}; style-src 'self' ${sha(css)}`,
        `<style>${css}</style><script src="/a.js"></script>`,
        `<script>${js}</script><script type="application/ld+json">{"@type":"Thing"}</script>`,
      ),
    });
    const r = run('check-csp.mjs', root);
    expect(r.code).toBe(0);
    expect(r.out).toContain('OK (1 pages');
  });

  it('refuses an unhashed <style> or inline <script>', () => {
    const root = project({
      'dist/index.html': page("script-src 'self'", '<style>a{}</style>', '<script>x()</script>'),
    });
    const r = run('check-csp.mjs', root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('unhashedStyle');
    expect(r.out).toContain('unhashedScript');
  });

  it('still sees inline code behind an unusual end tag', () => {
    const root = project({
      'dist/index.html': page(
        "script-src 'self'",
        '<STYLE media="all">a{}</style >',
        '<script>x()</script foo>',
      ),
    });
    const r = run('check-csp.mjs', root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('unhashedStyle');
    expect(r.out).toContain('unhashedScript');
  });

  it.each(['style="color:red"', "STYLE='color:red'", 'style=color:red'])(
    'refuses the style attribute %s',
    (attr) => {
      const root = project({ 'dist/a.html': page("default-src 'self'", '', `<p ${attr}>x</p>`) });
      const r = run('check-csp.mjs', root);
      expect(r.code).toBe(1);
      expect(r.out).toContain('styleAttr');
    },
  );

  it('lets an empty style attribute through', () => {
    const root = project({ 'dist/a.html': page("default-src 'self'", '', '<p style="">x</p>') });
    expect(run('check-csp.mjs', root).code).toBe(0);
  });

  it('fails a page without a policy, and a dist/ without pages', () => {
    const missing = project({ 'dist/a.html': `<html><head>${CHARSET}</head></html>` });
    expect(run('check-csp.mjs', missing).out).toContain('missingCsp');
    const r = run('check-csp.mjs', project({ 'dist/sw.js': '' }));
    expect(r.code).toBe(1);
    expect(r.out).toContain('found no HTML pages');
  });

  it('fails when a script precedes the policy, until postbuild moves it first', () => {
    const late =
      `<!doctype html><html><head>${CHARSET}<script src="/t.js"></script>` +
      `${meta("script-src 'self'")}</head><body></body></html>`;
    const root = project({ 'dist/index.html': late, 'dist/vi/index.html': late });
    expect(run('check-csp.mjs', root).out).toContain('lateCsp');

    expect(run('postbuild.mjs', root).out).toContain('moved to the top of <head> on 2 of 2 pages');
    const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
    expect(html.indexOf(meta("script-src 'self'"))).toBe(html.indexOf(CHARSET) + CHARSET.length);
    expect(run('check-csp.mjs', root).code).toBe(0);

    // Idempotent: a second pass changes nothing.
    expect(run('postbuild.mjs', root).out).toContain('on 0 of 2 pages');
  });
});

describe('check-assets', () => {
  const html = (head: string): string => page("default-src 'self'", head);

  it('passes when every same-origin asset exists', () => {
    const root = project({
      'dist/index.html': html(
        '<script src="/_astro/a.js?v=1"></script><link rel="stylesheet" href="/_astro/a.css">' +
          '<link rel="canonical" href="/not-an-asset"><link rel="icon" href="https://x.test/i.png">' +
          '<img src="//cdn.test/x.png">',
      ),
      'dist/_astro/a.js': '',
      'dist/_astro/a.css': '',
    });
    const r = run('check-assets.mjs', root);
    expect(r.code).toBe(0);
    expect(r.out).toContain('OK (1 pages, 2 distinct same-origin assets exist)');
  });

  it('fails on a missing asset and on a data: script', () => {
    const root = project({
      'dist/index.html': html(
        '<script src="data:text/javascript,1"></script><link rel="stylesheet" href="/gone.css">' +
          '<img src="/logo%20x.svg">',
      ),
    });
    const r = run('check-assets.mjs', root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('script is a data: URL');
    expect(r.out).toContain('link[stylesheet] /gone.css does not exist');
    expect(r.out).toContain('image /logo x.svg does not exist');
  });
});
