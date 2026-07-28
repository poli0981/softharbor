// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/11 §2 — issueUrl. Spike S3 sets BUDGET; these pin the behaviour.

import { describe, expect, it } from 'vitest';
import { BUDGET, buildBugUrl } from './issueUrl';

const CTX = { href: 'https://softharbor.net/apps/7-zip', userAgent: 'UA/1.0', lang: 'en' };
const line = (n: number) => `[2026-07-27T00:00:00.000Z] error ${n} ${'x'.repeat(80)}`;

describe('buildBugUrl', () => {
  it('targets the form and maps params to field ids (docs/12 §7)', () => {
    const u = new URL(buildBugUrl('boom', CTX));
    expect(u.pathname).toBe('/poli0981/softharbor/issues/new');
    expect(u.searchParams.get('template')).toBe('bug_report.yml');
    expect(u.searchParams.get('labels')).toBe('bug');
    expect(u.searchParams.get('page-url')).toBe(CTX.href);
    expect(u.searchParams.get('environment')).toBe('UA/1.0 · lang=en');
    expect(u.searchParams.get('console-output')).toBe('boom');
  });

  it('marks an empty buffer explicitly rather than sending a blank field', () => {
    expect(new URL(buildBugUrl('', CTX)).searchParams.get('console-output')).toBe('(buffer empty)');
  });

  it('respects the budget', () => {
    const huge = Array.from({ length: 400 }, (_, i) => line(i)).join('\n');
    expect(buildBugUrl(huge, CTX).length).toBeLessThanOrEqual(BUDGET);
  });

  it('drops OLDEST lines first — the newest error is the useful one', () => {
    const huge = Array.from({ length: 400 }, (_, i) => line(i)).join('\n');
    const out = new URL(buildBugUrl(huge, CTX)).searchParams.get('console-output') ?? '';
    expect(out).toContain('error 399');
    expect(out).not.toContain('error 0 ');
  });

  it('survives characters that would break a naive query string', () => {
    const nasty = 'a#b&c=d\ne\tf "g" <h> 100% ünïcödé 日本語 đường';
    const out = new URL(buildBugUrl(nasty, CTX)).searchParams.get('console-output');
    expect(out).toBe(nasty); // round-trips exactly through URLSearchParams
  });

  it('never emits a URL over budget even when a single line exceeds it', () => {
    // One unsplittable 20k line: the loop must terminate, not spin.
    expect(buildBugUrl('y'.repeat(20000), CTX).length).toBeLessThanOrEqual(BUDGET);
  });
});
