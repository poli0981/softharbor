// @vitest-environment happy-dom
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// The human check's decision table, against a scripted fake of Cloudflare's
// widget. The one property everything here protects: it ALWAYS resolves, and
// only a 200 from /api/verify resolves to "passed".

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTION,
  loadTurnstile,
  runHumanCheck,
  SCRIPT_URL,
  sitekeyFor,
  SITEKEY,
  TEST_SITEKEY,
  type CheckOptions,
  type TurnstileApi,
} from './turnstile';

type Callbacks = Record<string, (...args: unknown[]) => unknown>;

/** A fake widget whose callbacks the test fires by hand. */
function fakeTurnstile() {
  let options: Record<string, unknown> = {};
  const api = {
    render: vi.fn((_el: HTMLElement, o: Record<string, unknown>) => {
      options = o;
      return 'w1';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  } satisfies TurnstileApi;
  const fire = (name: string, ...args: unknown[]) => (options as Callbacks)[name]?.(...args);
  return { api, fire, options: () => options };
}

function statuses(...codes: Array<number | Error>) {
  const queue = [...codes];
  return vi.fn(async () => {
    const next = queue.shift() ?? 500;
    if (next instanceof Error) throw next;
    return new Response(null, { status: next });
  });
}

function check(
  t: ReturnType<typeof fakeTurnstile>,
  fetch: NonNullable<CheckOptions['fetch']>,
  over: Partial<CheckOptions> = {},
) {
  let result: string | undefined;
  const done = runHumanCheck(document.createElement('div'), {
    sitekey: SITEKEY,
    theme: 'dark',
    language: 'vi',
    load: async () => t.api,
    fetch,
    ...over,
  }).then((r) => (result = r));
  return { done, result: () => result };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete window.turnstile;
  document.head.innerHTML = '';
});

describe('runHumanCheck', () => {
  it('passes once /api/verify accepts the token, and cleans the widget up', async () => {
    const t = fakeTurnstile();
    const fetch = statuses(200);
    const c = check(t, fetch);
    await vi.advanceTimersByTimeAsync(0);

    expect(t.options()).toMatchObject({
      sitekey: SITEKEY,
      action: ACTION,
      theme: 'dark',
      language: 'vi',
      appearance: 'interaction-only',
      'response-field': false,
      retry: 'never',
    });
    t.fire('callback', 'tok-1');
    await c.done;

    expect(c.result()).toBe('passed');
    expect(fetch).toHaveBeenCalledWith(
      '/api/verify',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'tok-1' }) }),
    );
    expect(t.api.remove).toHaveBeenCalledWith('w1');
  });

  it('answers a rejection with a fresh challenge, not a resubmission', async () => {
    const t = fakeTurnstile();
    const c = check(t, statuses(403, 200));
    await vi.advanceTimersByTimeAsync(0);
    t.fire('callback', 'spent');
    await vi.advanceTimersByTimeAsync(0);
    expect(t.api.reset).toHaveBeenCalledWith('w1');
    expect(c.result()).toBeUndefined();

    t.fire('callback', 'fresh');
    await c.done;
    expect(c.result()).toBe('passed');
  });

  it('gives up after three rejected challenges', async () => {
    const t = fakeTurnstile();
    const c = check(t, statuses(403, 403, 403));
    await vi.advanceTimersByTimeAsync(0);
    for (const token of ['a', 'b', 'c']) {
      t.fire('callback', token);
      await vi.advanceTimersByTimeAsync(0);
    }
    await c.done;
    expect(t.api.reset).toHaveBeenCalledTimes(2);
    expect(c.result()).toBe('unverified');
  });

  it.each([
    ['the Worker is unconfigured or Siteverify is down', 503],
    ['the visitor is rate-limited', 429],
    ['the endpoint is missing (astro preview)', 404],
    ['the request fails outright', new TypeError('Failed to fetch')],
  ])('lets the visitor through unverified when %s', async (_why, answer) => {
    const t = fakeTurnstile();
    const c = check(t, statuses(answer));
    await vi.advanceTimersByTimeAsync(0);
    t.fire('callback', 'tok');
    await c.done;
    expect(c.result()).toBe('unverified');
  });

  it('marks widget errors handled (so Turnstile does not throw) and fails open', async () => {
    const t = fakeTurnstile();
    const c = check(t, statuses());
    await vi.advanceTimersByTimeAsync(0);
    expect(t.fire('error-callback', '110200')).toBe(true);
    await c.done;
    expect(c.result()).toBe('unverified');
  });

  it.each(['unsupported-callback', 'timeout-callback'])('fails open on %s', async (name) => {
    const t = fakeTurnstile();
    const c = check(t, statuses());
    await vi.advanceTimersByTimeAsync(0);
    t.fire(name);
    await c.done;
    expect(c.result()).toBe('unverified');
  });

  it('fails open when the script cannot load, or the widget will not render', async () => {
    const blocked = check(fakeTurnstile(), statuses(), {
      load: () => Promise.reject(new Error('blocked')),
    });
    await blocked.done;
    expect(blocked.result()).toBe('unverified');

    const t = fakeTurnstile();
    t.api.render.mockReturnValue(undefined as unknown as string);
    const c = check(t, statuses());
    await c.done;
    expect(c.result()).toBe('unverified');
  });

  it('stops waiting after 10 s — unless the widget is asking the person to click', async () => {
    const silent = check(fakeTurnstile(), statuses());
    await vi.advanceTimersByTimeAsync(9_999);
    expect(silent.result()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(silent.result()).toBe('unverified');

    const t = fakeTurnstile();
    const c = check(t, statuses(200));
    await vi.advanceTimersByTimeAsync(5_000);
    t.fire('before-interactive-callback');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(c.result()).toBeUndefined(); // still the person's turn
    t.fire('callback', 'clicked');
    await c.done;
    expect(c.result()).toBe('passed');
  });

  it('resolves exactly once, whatever fires afterwards', async () => {
    const t = fakeTurnstile();
    const fetch = statuses(200, 200);
    const c = check(t, fetch);
    await vi.advanceTimersByTimeAsync(0);
    t.fire('error-callback');
    t.fire('callback', 'late');
    await c.done;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(c.result()).toBe('unverified');
  });
});

describe('sitekeyFor', () => {
  it('uses the test key only on local hosts', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]'])
      expect(sitekeyFor(host)).toBe(TEST_SITEKEY);
    for (const host of ['softharbor.net', 'abc123.softharbor.workers.dev'])
      expect(sitekeyFor(host)).toBe(SITEKEY);
  });
});

describe('loadTurnstile', () => {
  // happy-dom would try to fetch api.js for real (and fire `error` on its own
  // the moment the element is inserted), so the document is a fake whose
  // network the test plays by dispatching load/error itself.
  class FakeScript extends EventTarget {
    src = '';
    async = false;
    removed = false;
    remove(): void {
      this.removed = true;
    }
  }
  function fakeDocument() {
    const scripts: FakeScript[] = [];
    const doc = {
      createElement: () => new FakeScript(),
      head: { append: (el: FakeScript) => scripts.push(el) },
    };
    return { doc: doc as unknown as Document, scripts };
  }

  it('injects api.js once and resolves with the API it defines', async () => {
    const { doc, scripts } = fakeDocument();
    const first = loadTurnstile(doc);
    const again = loadTurnstile(doc);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.src).toBe(SCRIPT_URL);
    expect(scripts[0]!.async).toBe(true);

    const api = fakeTurnstile().api;
    window.turnstile = api;
    scripts[0]!.dispatchEvent(new Event('load'));
    await expect(first).resolves.toBe(api);
    await expect(again).resolves.toBe(api);
    // Already loaded: no second script, resolved straight from window.
    await expect(loadTurnstile(doc)).resolves.toBe(api);
    expect(scripts).toHaveLength(1);
  });

  it('forgets a failed load, so the next gate tries again', async () => {
    const { doc, scripts } = fakeDocument();
    const failed = loadTurnstile(doc);
    scripts[0]!.dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow(/blocked or offline/);
    expect(scripts[0]!.removed).toBe(true);

    const retry = loadTurnstile(doc);
    expect(scripts).toHaveLength(2);
    scripts[1]!.dispatchEvent(new Event('load')); // loaded, yet no API defined
    await expect(retry).rejects.toThrow(/without an API/);
  });
});
