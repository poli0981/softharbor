// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The L2 rules (docs/03 §2) — the ones the Zod schema cannot express — each
// proven to fire, plus the clean case proven NOT to.

import { describe, expect, it } from 'vitest';
import { project, run } from './fixture';

const day = (offset: number): string =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const TODAY = day(0);
const ZWSP = String.fromCharCode(0x200b);

type App = Record<string, unknown>;
const app = (over: App = {}): App => ({
  name: 'Firefox',
  categories: ['browser'],
  links: { homepage: 'https://www.firefox.com/', repo: null },
  logo: 'simple-icons:firefox',
  addedAt: TODAY,
  updatedAt: TODAY,
  summary: { en: 'A browser.', vi: 'Trình duyệt.' },
  security: {
    status: 'clean',
    checkedAt: TODAY,
    evidence: 'https://www.virustotal.com/gui/url/abc',
  },
  ...over,
});

/** A project with categories.json and the given apps (slug → entry, or raw text). */
function data(apps: Record<string, App | string>, extra: Record<string, string> = {}): string {
  const files: Record<string, string> = {
    'src/data/categories.json': JSON.stringify([{ id: 'browser' }, { id: 'security-privacy' }]),
    ...extra,
  };
  for (const [slug, entry] of Object.entries(apps)) {
    files[`src/data/apps/${slug}.json`] = typeof entry === 'string' ? entry : JSON.stringify(entry);
  }
  return project(files);
}

const validate = (root: string) => run('validate-data.mjs', root);

describe('validate-data', () => {
  it('passes a clean dataset', () => {
    const r = validate(data({ firefox: app(), 'tor-browser': app({ name: 'Tor Browser' }) }));
    expect(r.code).toBe(0);
    expect(r.out).toContain('validate:data — OK (2 apps, 2 categories)');
  });

  it.each([
    { rule: 'slug-format', apps: { Fire_Fox: app() } },
    { rule: 'slug-length', apps: { [`a${'-b'.repeat(20)}`]: app() } },
    { rule: 'parse', apps: { firefox: '{ not json' } },
    { rule: 'duplicate-name', apps: { firefox: app(), 'firefox-2': app({ name: 'FÍREFOX ' }) } },
    { rule: 'unknown-category', apps: { firefox: app({ categories: ['browsers'] }) } },
    { rule: 'bad-url', apps: { firefox: app({ links: { homepage: 'firefox.com' } }) } },
    { rule: 'insecure-link', apps: { firefox: app({ links: { homepage: 'http://x.org/' } }) } },
    {
      rule: 'punycode-host',
      apps: { firefox: app({ links: { homepage: 'https://xn--80ak6aa92e.com/' } }) },
    },
    {
      rule: 'download-portal',
      apps: { firefox: app({ links: { download: 'https://en.softonic.com/firefox' } }) },
    },
    {
      rule: 'tracking-param',
      apps: { firefox: app({ links: { homepage: 'https://www.firefox.com/?utm_source=x' } }) },
    },
    {
      rule: 'invisible-char',
      apps: { firefox: app({ summary: { en: `A${ZWSP}browser.`, vi: 'Trình duyệt.' } }) },
    },
    {
      rule: 'flagged-in-main-tree',
      apps: { firefox: app({ security: { status: 'flagged', checkedAt: TODAY } }) },
    },
    { rule: 'future-date', apps: { firefox: app({ addedAt: day(3), updatedAt: day(3) }) } },
    { rule: 'date-order', apps: { firefox: app({ addedAt: TODAY, updatedAt: day(-1) }) } },
  ])('fails $rule', ({ rule, apps }) => {
    const r = validate(data(apps));
    expect(r.code).toBe(1);
    expect(r.out).toContain(rule);
  });

  it('checks the evidence link like any other', () => {
    const security = { status: 'clean', checkedAt: TODAY, evidence: 'http://vt.test/x' };
    expect(validate(data({ firefox: app({ security }) })).out).toContain(
      'insecure-link           security.evidence',
    );
  });

  it('compares local logos case-sensitively, as Linux CI and Workers Builds do', () => {
    const extra = { 'src/assets/logos/Firefox.svg': '<svg/>' };
    const wrongCase = validate(data({ firefox: app({ logo: 'local:firefox.svg' }) }, extra));
    expect(wrongCase.code).toBe(1);
    expect(wrongCase.out).toContain('missing-logo');
    expect(validate(data({ firefox: app({ logo: 'local:Firefox.svg' }) }, extra)).code).toBe(0);
  });

  it('warns, without failing, when a security check is due', () => {
    const security = { status: 'clean', checkedAt: day(-200), evidence: 'https://vt.test/x' };
    const r = validate(data({ firefox: app({ addedAt: day(-300), security }) }));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(
      /stale-check: 1 entry — e\.g\. firefox\.json: security checked 20\d days ago/,
    );
  });

  it('keeps quarantine honest: flagged only, and never live at the same time', () => {
    const flagged = JSON.stringify(app({ security: { status: 'flagged', checkedAt: TODAY } }));
    const ok = validate(
      data({ other: app({ name: 'Other' }) }, { 'data/quarantine/firefox.json': flagged }),
    );
    expect(ok.code).toBe(0);

    const restored = JSON.stringify(app());
    const unflagged = validate(data({}, { 'data/quarantine/firefox.json': restored }));
    expect(unflagged.out).toContain('unflagged-in-quarantine');

    const both = validate(data({ firefox: app() }, { 'data/quarantine/firefox.json': flagged }));
    expect(both.code).toBe(1);
    expect(both.out).toContain('slug-in-both-trees');
  });
});
