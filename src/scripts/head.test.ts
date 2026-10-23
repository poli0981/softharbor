// @vitest-environment happy-dom
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The three head scripts ship verbatim (Base.astro, `?url&no-inline`), so
// nothing type-checks or bundles them. Each test re-imports the REAL file after
// vi.resetModules(), which re-runs its IIFE against the globals set up first.
// src/lib/prefs.test.ts separately pins theme.js to the typed helpers it
// mirrors; this file covers what the scripts do on their own.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Classic scripts, not modules: a specifier held in a variable keeps the type
// checker from demanding exports while Vitest still resolves (and measures)
// the real file next to this one.
const SCRIPTS = {
  theme: './theme.js',
  errors: './errors.js',
  analytics: './analytics.js',
} as const;

async function run(name: keyof typeof SCRIPTS): Promise<void> {
  vi.resetModules();
  await import(/* @vite-ignore */ SCRIPTS[name]);
}

function stubStorage(seed: Record<string, string> = {}, mode: 'ok' | 'throws' = 'ok') {
  const map = new Map(Object.entries(seed));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => {
        if (mode === 'throws') throw new DOMException('denied', 'SecurityError');
        return map.get(k) ?? null;
      },
    },
  });
}

function prefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark, media: query }));
}

const root = () => document.documentElement;

/** happy-dom's own window API; not part of the DOM typings. */
const setURL = (url: string) =>
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);

const clearPrefs = () => {
  for (const attr of ['data-theme', 'data-scrollbar', 'data-motion']) root().removeAttribute(attr);
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearPrefs();
});

describe('theme.js (pre-paint display preferences)', () => {
  it('applies an explicit stored theme over the OS setting', async () => {
    stubStorage({ 'sh:theme': 'dark' });
    prefersDark(false);
    await run('theme');
    expect(root().dataset['theme']).toBe('dark');
  });

  it('follows the OS when nothing valid is stored', async () => {
    stubStorage({ 'sh:theme': 'sepia' });
    prefersDark(true);
    await run('theme');
    expect(root().dataset['theme']).toBe('dark');

    prefersDark(false);
    await run('theme');
    expect(root().dataset['theme']).toBe('light');
  });

  it('falls back to the OS when storage throws instead of aborting', async () => {
    stubStorage({}, 'throws');
    prefersDark(true);
    await run('theme');
    expect(root().dataset['theme']).toBe('dark');
    expect(root().dataset['scrollbar']).toBeUndefined();
    expect(root().dataset['motion']).toBeUndefined();
  });

  it('applies only known scrollbar and motion choices', async () => {
    prefersDark(false);
    stubStorage({ 'sh:scrollbar': 'thin', 'sh:motion': 'reduce' });
    await run('theme');
    expect(root().dataset['scrollbar']).toBe('thin');
    expect(root().dataset['motion']).toBe('reduce');

    clearPrefs();
    stubStorage({ 'sh:scrollbar': 'wide', 'sh:motion': 'fast' });
    await run('theme');
    expect(root().dataset['scrollbar']).toBeUndefined();
    expect(root().dataset['motion']).toBeUndefined();

    stubStorage({ 'sh:scrollbar': 'hidden' });
    await run('theme');
    expect(root().dataset['scrollbar']).toBe('hidden');
  });

  it("marks an aborted view transition's promises as handled", async () => {
    stubStorage();
    prefersDark(false);
    await run('theme');

    const promise = () => ({ catch: vi.fn() });
    const vt = { ready: promise(), finished: promise(), updateCallbackDone: undefined };
    for (const type of ['pageswap', 'pagereveal']) {
      window.dispatchEvent(Object.assign(new Event(type), { viewTransition: vt }));
    }
    expect(vt.ready.catch).toHaveBeenCalled();
    expect(vt.finished.catch).toHaveBeenCalled();

    // A navigation without a transition carries none; nothing to settle.
    expect(() => window.dispatchEvent(new Event('pagereveal'))).not.toThrow();
  });
});

describe('errors.js (console ring buffer)', () => {
  const buffer = () => (globalThis as unknown as { __shErrors: string[] }).__shErrors;
  const fire = (target: EventTarget, type: string, props: Record<string, unknown>) =>
    target.dispatchEvent(Object.assign(new Event(type), props));
  const scriptError = (props: Record<string, unknown>) =>
    window.dispatchEvent(new ErrorEvent('error', props));

  beforeEach(async () => {
    Reflect.deleteProperty(globalThis, '__shErrors');
    await run('errors');
  });

  it('records same-origin script errors with their position, stamped', () => {
    scriptError({
      message: 'boom',
      filename: `${location.origin}/_astro/app.js`,
      lineno: 3,
      colno: 7,
    });
    expect(buffer()).toHaveLength(1);
    expect(buffer()[0]).toMatch(
      /^\[\d{4}-\d\d-\d\dT[^\]]+\] \/\S* error: boom @ .*\/_astro\/app\.js:3:7$/,
    );
  });

  it('labels an error without a file as inline', () => {
    scriptError({ message: 'inline boom', lineno: 1, colno: 2 });
    expect(buffer()[0]).toContain('error: inline boom @ inline:1:2');
  });

  it('skips resource failures and other origins', () => {
    scriptError({ message: '' });
    scriptError({ message: 'extension', filename: 'chrome-extension://abc/content.js' });
    expect(buffer()).toEqual([]);
  });

  it('de-duplicates a repeating failure and keeps only the newest 20 lines', () => {
    for (let i = 0; i < 3; i++) scriptError({ message: 'loop' });
    expect(buffer()).toHaveLength(1);

    for (let i = 0; i < 25; i++) scriptError({ message: `distinct ${i}` });
    expect(buffer()).toHaveLength(20);
    expect(buffer().at(-1)).toContain('distinct 24');
    expect(buffer().some((line) => line.includes('error: loop'))).toBe(false);
  });

  it('caps a line at 500 characters', () => {
    scriptError({ message: 'x'.repeat(2000) });
    expect(buffer()[0]).toHaveLength(500);
  });

  it('records unhandled rejections by the first two stack lines, or the value', () => {
    const err = new Error('nope');
    err.stack = 'Error: nope\n    at a (x.js:1:1)\n    at b (y.js:2:2)';
    fire(window, 'unhandledrejection', { reason: err });
    fire(window, 'unhandledrejection', { reason: 'plain reason' });
    expect(buffer()[0]).toContain('unhandledrejection: Error: nope |     at a (x.js:1:1)');
    expect(buffer()[0]).not.toContain('y.js');
    expect(buffer()[1]).toContain('unhandledrejection: plain reason');
  });

  it('records CSP violations, which a meta policy cannot report anywhere else', () => {
    fire(document, 'securitypolicyviolation', {
      effectiveDirective: 'script-src-elem',
      blockedURI: 'https://evil.example/x.js',
      sourceFile: `${location.origin}/apps`,
      lineNumber: 12,
    });
    fire(document, 'securitypolicyviolation', { effectiveDirective: 'style-src-attr' });
    expect(buffer()[0]).toContain(
      `csp: script-src-elem blocked https://evil.example/x.js @ ${location.origin}/apps:12`,
    );
    expect(buffer()[1]).toContain('csp: style-src-attr blocked inline');
  });

  it("records Astro's re-dispatched hydration errors", () => {
    fire(document, 'astro:hydration-error', {
      detail: { componentUrl: '/_astro/ShSearch.js', error: new Error('hydrate') },
    });
    fire(document, 'astro:hydration-error', {});
    expect(buffer()[0]).toContain('hydration: /_astro/ShSearch.js — Error: hydrate');
    expect(buffer()[1]).toContain('hydration: ? — undefined');
  });

  it('keeps the buffer another copy of the script already created', async () => {
    (globalThis as Record<string, unknown>)['__shErrors'] = ['[earlier] kept'];
    await run('errors');
    expect(buffer()).toEqual(['[earlier] kept']);
  });
});

describe('analytics.js (Web Analytics beacon, D26)', () => {
  const append = () => vi.spyOn(document.head, 'append').mockImplementation(() => {});

  function setGpc(value: boolean | undefined) {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value });
  }

  afterEach(() => {
    setURL('http://localhost:3000/');
    setGpc(undefined);
  });

  it('loads the beacon on the production host when GPC is not set', async () => {
    setURL('https://softharbor.net/apps');
    setGpc(undefined);
    const spy = append();
    await run('analytics');

    expect(spy).toHaveBeenCalledTimes(1);
    const beacon = spy.mock.calls[0]?.[0] as HTMLScriptElement;
    expect(beacon.type).toBe('module');
    expect(beacon.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(JSON.parse(beacon.dataset['cfBeacon'] ?? '')).toEqual({
      token: '3901bbd0eb53453aa51bc10390e07fd3',
    });
  });

  it('sends nothing under Global Privacy Control', async () => {
    setURL('https://softharbor.net/');
    setGpc(true);
    const spy = append();
    await run('analytics');
    expect(spy).not.toHaveBeenCalled();
  });

  it('sends nothing from previews, localhost or the e2e suite', async () => {
    setGpc(false);
    const spy = append();
    for (const url of ['http://localhost:4321/', 'https://abc123-softharbor.workers.dev/']) {
      setURL(url);
      await run('analytics');
    }
    expect(spy).not.toHaveBeenCalled();
  });
});
