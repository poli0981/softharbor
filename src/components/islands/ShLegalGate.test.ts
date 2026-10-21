// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/11 §3, docs/14 Part 2.
//
// Drives the real component through Svelte's mount() in happy-dom. Covers the
// interaction contract: blocks before acceptance, Esc cannot dismiss it, a
// premature close is undone, acceptance persists, and the copy is the
// dictionary's. Real top-layer stacking, the native `closedby` behaviour and
// "no visual flash" need a real browser — they are covered by the Playwright
// suite (e2e/gate.spec.ts), not here.
//
// Route exemptions are no longer the island's job: exempt pages (legal
// documents, error and offline pages) never render it (Base.astro
// `gateExempt`), so there is nothing to assert about them at this level.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi as vitestVi } from 'vitest';
import ShLegalGate from './ShLegalGate.svelte';
import en from '../../i18n/en.json';
import vi from '../../i18n/vi.json';

/**
 * Real dictionary strings, so these tests break if a gate key is renamed or
 * dropped — the point of keeping the copy out of the island.
 */
const STRINGS = {
  en: {
    title: en['gate.title'],
    body: en['gate.body'],
    accept: en['gate.accept'],
    disclaimer: en['gate.link.disclaimer'],
    terms: en['gate.link.terms'],
    privacy: en['gate.link.privacy'],
    and: en['gate.and'],
    base: '/legal',
  },
  vi: {
    title: vi['gate.title'],
    body: vi['gate.body'],
    accept: vi['gate.accept'],
    disclaimer: vi['gate.link.disclaimer'],
    terms: vi['gate.link.terms'],
    privacy: vi['gate.link.privacy'],
    and: vi['gate.and'],
    base: '/vi/legal',
  },
};

/** mount() schedules effects in a microtask; flush so assertions see onMount. */
function mountGate(target: HTMLElement, locale: 'en' | 'vi' = 'en') {
  const instance = mount(ShLegalGate, { target, props: { strings: STRINGS[locale] } });
  flushSync();
  return instance;
}

function stubStorage(seed?: string) {
  const map = new Map<string, string>();
  if (seed !== undefined) map.set('sh:legal', seed);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    },
  });
  return map;
}

/** Lets queued microtasks (the gate's re-open) run. */
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

let target: HTMLElement;
let app: Record<string, unknown> | undefined;

const gate = () => document.querySelector<HTMLDialogElement>('[data-testid="sh-legal-gate"]')!;
const acceptBtn = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="sh-legal-accept"]')!;

beforeEach(() => {
  document.body.innerHTML = '';
  delete document.body.dataset['shGate'];
  target = document.createElement('div');
  document.body.appendChild(target);
});

afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  Reflect.deleteProperty(globalThis, 'localStorage');
  Reflect.deleteProperty(globalThis, '__shLegalAcceptedThisSession');
  vitestVi.resetModules();
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
    await tick();
    flushSync();
    expect(gate().open).toBe(true);
    expect(document.body.dataset['shGate']).toBe('open');
  });
});

describe('ShLegalGate — acceptance', () => {
  it('closes and persists on accept', async () => {
    const store = stubStorage();
    app = mountGate(target);
    acceptBtn().click();
    await tick();
    flushSync();
    expect(gate().open).toBe(false);
    expect(document.body.dataset['shGate']).toBe('closed');
    expect(store.get('sh:legal')).toBeDefined();
  });

  it('stays closed for a visitor who accepted the current version', async () => {
    const { LEGAL_VERSION } = await import('../../lib/legal');
    stubStorage(LEGAL_VERSION);
    app = mountGate(target);
    expect(gate().open).toBe(false);
    expect(document.body.dataset['shGate']).toBe('closed');
  });

  it('re-opens for everyone when LEGAL_VERSION moves on', () => {
    stubStorage('2020-01-01'); // accepted an older draft
    app = mountGate(target);
    expect(gate().open).toBe(true);
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
});
