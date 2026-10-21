// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/11 §3, docs/14 Part 2, docs/09 §4a.
//
// Drives the real component through Svelte's mount() in happy-dom. Covers the
// interaction contract: blocks before acceptance, Esc cannot dismiss it, a
// premature close is undone, acceptance persists, the copy is the
// dictionary's — and the human check: Turnstile only AFTER acceptance, a pass
// remembered for 48 h, a failure that lets the visitor through anyway. The
// check itself (src/lib/turnstile.ts) is stubbed here and tested on its own.
// Real top-layer stacking, the native `closedby` behaviour and "no visual
// flash" need a real browser — they are covered by e2e/gate.spec.ts.
//
// Route exemptions are not the island's job: exempt pages (legal documents,
// error and offline pages) never render it (Base.astro `gateExempt`).

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PASS_TTL_MS, UNVERIFIED_TTL_MS } from '../../lib/human';
import { LEGAL_VERSION } from '../../lib/legal';
import { runHumanCheck, type HumanResult } from '../../lib/turnstile';
import ShLegalGate from './ShLegalGate.svelte';
import en from '../../i18n/en.json';
import viDict from '../../i18n/vi.json';

vi.mock('../../lib/turnstile', () => ({
  runHumanCheck: vi.fn(),
  sitekeyFor: () => 'test-sitekey',
}));

/**
 * Real dictionary strings, so these tests break if a gate key is renamed or
 * dropped — the point of keeping the copy out of the island.
 */
const strings = (d: typeof en, base: string, lang: string) => ({
  title: d['gate.title'],
  body: d['gate.body'],
  accept: d['gate.accept'],
  disclaimer: d['gate.link.disclaimer'],
  terms: d['gate.link.terms'],
  privacy: d['gate.link.privacy'],
  and: d['gate.and'],
  base,
  verifyTitle: d['gate.verify.title'],
  verifyBody: d['gate.verify.body'],
  verifySkipped: d['gate.verify.skipped'],
  lang,
});
const STRINGS = { en: strings(en, '/legal', 'en'), vi: strings(viDict, '/vi/legal', 'vi') };

/** mount() schedules effects in a microtask; flush so assertions see onMount. */
function mountGate(target: HTMLElement, locale: 'en' | 'vi' = 'en') {
  const instance = mount(ShLegalGate, { target, props: { strings: STRINGS[locale] } });
  flushSync();
  return instance;
}

function stubStorage(seed: { legal?: string; humanUntil?: number } = {}) {
  const map = new Map<string, string>();
  if (seed.legal !== undefined) map.set('sh:legal', seed.legal);
  if (seed.humanUntil !== undefined) map.set('sh:human', String(seed.humanUntil));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    },
  });
  return map;
}

/** The human check's answer, held until the test releases it. */
function pendingCheck() {
  let answer: (r: HumanResult) => void = () => undefined;
  vi.mocked(runHumanCheck).mockReturnValue(new Promise((r) => (answer = r)));
  return (r: HumanResult) => answer(r);
}

/** Lets queued microtasks (the gate's re-open, the check's promise) run. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise<void>((r) => queueMicrotask(r));
  flushSync();
};

let target: HTMLElement;
let app: Record<string, unknown> | undefined;

const gate = () => document.querySelector<HTMLDialogElement>('[data-testid="sh-legal-gate"]')!;
const acceptBtn = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="sh-legal-accept"]')!;
const human = () => Date.now() + PASS_TTL_MS - 1000;

beforeEach(() => {
  document.body.innerHTML = '';
  delete document.body.dataset['shGate'];
  document.documentElement.dataset['theme'] = 'dark';
  target = document.createElement('div');
  document.body.appendChild(target);
});

afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  vi.useRealTimers();
  vi.clearAllMocks();
  Reflect.deleteProperty(globalThis, 'localStorage');
  Reflect.deleteProperty(globalThis, '__shLegalAcceptedThisSession');
  Reflect.deleteProperty(globalThis, '__shHumanUntil');
});

describe('ShLegalGate — blocks before acceptance', () => {
  it('opens modally for a first-time visitor', () => {
    stubStorage();
    app = mountGate(target);
    expect(gate().open).toBe(true);
    expect(document.body.dataset['shGate']).toBe('open');
  });

  it('declares closedby="none" so the platform offers no dismissal', () => {
    stubStorage();
    app = mountGate(target);
    expect(gate().getAttribute('closedby')).toBe('none');
  });

  it('intercepts Esc — the cancel event is prevented pre-accept', () => {
    stubStorage();
    app = mountGate(target);
    const cancel = new Event('cancel', { cancelable: true });
    gate().dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(gate().open).toBe(true);
  });

  it('re-opens itself if something closes it before acceptance', async () => {
    // Chromium can close a modal dialog on Esc despite preventDefault() when
    // there was no recent user activation. The close handler must undo that.
    stubStorage();
    app = mountGate(target);
    gate().close();
    await settle();
    expect(gate().open).toBe(true);
    expect(document.body.dataset['shGate']).toBe('open');
  });

  it('never loads Turnstile before the documents are accepted', () => {
    stubStorage();
    app = mountGate(target);
    expect(runHumanCheck).not.toHaveBeenCalled();
    expect(gate().dataset['step']).toBe('legal');
  });
});

describe('ShLegalGate — acceptance and the human check', () => {
  it('accept → checks → closes, remembering both for their own lifetimes', async () => {
    const store = stubStorage();
    const answer = pendingCheck();
    app = mountGate(target);
    acceptBtn().click();
    await settle();

    expect(store.get('sh:legal')).toBe(LEGAL_VERSION);
    expect(gate().dataset['step']).toBe('verify');
    expect(gate().open).toBe(true);
    expect(runHumanCheck).toHaveBeenCalledWith(
      document.querySelector('[data-testid="sh-gate-widget"]'),
      { sitekey: 'test-sitekey', theme: 'dark', language: 'en' },
    );
    // The step-2 heading takes focus, so a screen reader hears what is happening.
    expect(document.activeElement?.id).toBe('sh-gate-title');

    answer('passed');
    await settle();
    expect(gate().open).toBe(false);
    expect(document.body.dataset['shGate']).toBe('closed');
    const until = Number(store.get('sh:human'));
    expect(until - Date.now()).toBeGreaterThan(PASS_TTL_MS - 5000);
  });

  it('cannot be dismissed while the check runs', async () => {
    stubStorage();
    pendingCheck();
    app = mountGate(target);
    acceptBtn().click();
    await settle();
    const cancel = new Event('cancel', { cancelable: true });
    gate().dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    gate().close();
    await settle();
    expect(gate().open).toBe(true);
  });

  it('lets the visitor through when the check cannot run, and says so briefly', async () => {
    vi.useFakeTimers();
    const store = stubStorage();
    const answer = pendingCheck();
    app = mountGate(target, 'vi');
    acceptBtn().click();
    await settle();
    answer('unverified');
    await settle();

    const status = document.querySelector('[data-testid="sh-gate-status"]')!;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent?.trim()).toBe(viDict['gate.verify.skipped']);
    expect(gate().open).toBe(true);
    const until = Number(store.get('sh:human'));
    expect(until - Date.now()).toBeLessThanOrEqual(UNVERIFIED_TTL_MS);

    await vi.advanceTimersByTimeAsync(1500);
    flushSync();
    expect(gate().open).toBe(false);
  });

  it('skips straight to the check for a returning visitor whose check lapsed', async () => {
    stubStorage({ legal: LEGAL_VERSION });
    const answer = pendingCheck();
    app = mountGate(target, 'vi');
    await settle();
    expect(gate().open).toBe(true);
    expect(gate().dataset['step']).toBe('verify');
    expect(acceptBtn()).toBeNull();
    expect(vi.mocked(runHumanCheck).mock.calls[0]?.[1]).toMatchObject({ language: 'vi' });
    answer('passed');
    await settle();
    expect(gate().open).toBe(false);
  });

  it('closes on accept without a check when one already passed', async () => {
    stubStorage({ humanUntil: human() });
    app = mountGate(target);
    acceptBtn().click();
    await settle();
    expect(gate().open).toBe(false);
    expect(runHumanCheck).not.toHaveBeenCalled();
  });

  it('stays closed for a visitor who accepted and passed recently', () => {
    stubStorage({ legal: LEGAL_VERSION, humanUntil: human() });
    app = mountGate(target);
    expect(gate().open).toBe(false);
    expect(document.body.dataset['shGate']).toBe('closed');
    expect(runHumanCheck).not.toHaveBeenCalled();
  });

  it('re-opens for everyone when LEGAL_VERSION moves on', () => {
    stubStorage({ legal: '2020-01-01', humanUntil: human() }); // accepted an older draft
    app = mountGate(target);
    expect(gate().open).toBe(true);
    expect(gate().dataset['step']).toBe('legal');
  });
});

describe('ShLegalGate — copy', () => {
  it('links all three documents under the locale base, joined with "and"', () => {
    stubStorage();
    app = mountGate(target, 'vi');
    const links = [...gate().querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/vi/legal/disclaimer', '/vi/legal/terms', '/vi/legal/privacy']);
    expect(gate().textContent).toContain('Trước khi tiếp tục');
    expect(gate().textContent).toMatch(/Điều khoản sử dụng\s+và\s+Chính sách quyền riêng tư/);
  });

  it('describes itself with the body text for assistive tech', () => {
    stubStorage();
    app = mountGate(target);
    const describedBy = gate().getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toContain(en['gate.body']);
  });

  it('explains the check and links where the Privacy Policy describes it', async () => {
    stubStorage({ legal: LEGAL_VERSION });
    pendingCheck();
    app = mountGate(target);
    await settle();
    const body = document.getElementById(gate().getAttribute('aria-describedby')!)!;
    expect(body.textContent).toContain(en['gate.verify.body']);
    expect(body.querySelector('a')?.getAttribute('href')).toBe('/legal/privacy#turnstile');
  });
});
