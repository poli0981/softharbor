// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// Spike S4 — docs/11 §3, docs/14 Part 2.
//
// Drives the real component through Svelte's mount() in happy-dom. Covers the
// interaction contract (blocks pre-accept, Esc intercepted, exemptions, no
// re-flash across a simulated ClientRouter swap). Real top-layer stacking and
// "no visual flash" are NOT covered here — see the manual note in docs/11 §3.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShLegalGate from './ShLegalGate.svelte';

/** mount() schedules effects in a microtask; flush so assertions see onMount. */
function mountGate(target: HTMLElement) {
  const instance = mount(ShLegalGate, { target });
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

function goto(pathname: string) {
  // happy-dom allows navigation via history without a real load.
  history.replaceState({}, '', pathname);
}

/** Simulate what ClientRouter does to a `transition:persist`ed island. */
function clientRouterSwapTo(pathname: string) {
  goto(pathname);
  document.dispatchEvent(new Event('astro:after-swap'));
}

let target: HTMLElement;
let app: Record<string, unknown> | undefined;

const gate = () => document.querySelector<HTMLDialogElement>('[data-testid="sh-legal-gate"]')!;
const acceptBtn = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="sh-legal-accept"]')!;

beforeEach(() => {
  document.body.innerHTML = '';
  target = document.createElement('div');
  document.body.appendChild(target);
});

afterEach(() => {
  if (app) unmount(app);
  app = undefined;
  Reflect.deleteProperty(globalThis, 'localStorage');
  Reflect.deleteProperty(globalThis, '__shLegalAcceptedThisSession');
  vi.resetModules();
});

describe('ShLegalGate — blocks before acceptance', () => {
  it('opens modally on a gated route for a first-time visitor', () => {
    stubStorage();
    goto('/apps');
    app = mountGate(target);
    expect(gate().open).toBe(true);
    expect(document.body.dataset['shGate']).toBe('open');
  });

  it('intercepts Esc — the cancel event is prevented pre-accept', () => {
    stubStorage();
    goto('/apps');
    app = mountGate(target);
    const cancel = new Event('cancel', { cancelable: true });
    gate().dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(gate().open).toBe(true);
  });

  it('closes and persists on accept', () => {
    const store = stubStorage();
    goto('/apps');
    app = mountGate(target);
    acceptBtn().click();
    flushSync();
    expect(gate().open).toBe(false);
    expect(document.body.dataset['shGate']).toBe('closed');
    expect(store.get('sh:legal')).toBeDefined();
  });
});

describe('ShLegalGate — exemptions (docs/14 Part 2)', () => {
  it('never opens on a legal page, even unaccepted — the gate links there', () => {
    stubStorage();
    goto('/legal/disclaimer');
    app = mountGate(target);
    expect(gate().open).toBe(false);
  });

  it('never opens on /offline — an error state must not dead-lock', () => {
    stubStorage();
    goto('/offline');
    app = mountGate(target);
    expect(gate().open).toBe(false);
  });
});

describe('ShLegalGate — across ClientRouter navigations (the S4 question)', () => {
  it('does NOT re-flash after acceptance', () => {
    stubStorage();
    goto('/');
    app = mountGate(target);
    acceptBtn().click();
    flushSync();
    expect(gate().open).toBe(false);

    clientRouterSwapTo('/apps');
    flushSync();
    expect(gate().open).toBe(false);
    clientRouterSwapTo('/apps/7-zip');
    flushSync();
    expect(gate().open).toBe(false);
  });

  it('re-asserts the modal if a swap leaves the persisted dialog closed', () => {
    stubStorage();
    goto('/');
    app = mountGate(target);
    expect(gate().open).toBe(true);

    // Reproduce the hazard S4 exists to catch: a persisted <dialog> coming out
    // of a document swap with `open` cleared. Without the re-assert in
    // evaluate(), the site would be usable without accepting.
    gate().close();
    clientRouterSwapTo('/apps');
    flushSync();
    expect(gate().open).toBe(true);
  });

  it('closes when navigating from a gated route ONTO an exempt one', () => {
    stubStorage();
    goto('/apps');
    app = mountGate(target);
    expect(gate().open).toBe(true);

    clientRouterSwapTo('/legal/terms');
    flushSync();
    expect(gate().open).toBe(false);
  });

  it('re-opens when navigating back off an exempt route unaccepted', () => {
    stubStorage();
    goto('/legal/terms');
    app = mountGate(target);
    expect(gate().open).toBe(false);

    clientRouterSwapTo('/apps');
    flushSync();
    expect(gate().open).toBe(true);
  });

  it('re-opens for everyone when LEGAL_VERSION moves on', () => {
    stubStorage('2020-01-01'); // accepted an older draft
    goto('/apps');
    app = mountGate(target);
    expect(gate().open).toBe(true);
  });

  it('follows the locale across a swap, not the prop it first rendered with', () => {
    // transition:persist keeps this island alive across /apps -> /vi/apps.
    // The `locale` prop is frozen at the first render, so without deriving
    // from the URL a Vietnamese page would show the English gate.
    stubStorage();
    goto('/apps');
    app = mountGate(target);
    expect(gate().textContent).toContain('Before you continue');

    clientRouterSwapTo('/vi/apps');
    flushSync();
    expect(gate().textContent).toContain('Trước khi tiếp tục');
    expect(gate().querySelector('a')?.getAttribute('href')).toBe('/vi/legal/disclaimer');
  });
});
