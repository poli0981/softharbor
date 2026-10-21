// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/09 §4a — the browser half of the legal gate's human check (step 2 of
// ShLegalGate; the server half is worker/verify.ts).
//
// Turnstile is loaded only here, only when the gate asks — after the visitor
// has accepted the documents that describe it, never before. One Managed
// widget runs with `appearance: interaction-only`, so most people never see
// it; its token goes to POST /api/verify.
//
// Every failure resolves to "unverified", never to an exception or a dead
// end: the site is public, the check is a courtesy filter rather than a lock,
// and a blocked script, an outage or a slow network must not keep a person
// out (fail-open, the pattern used across this author's sites).

/** Public by design: the widget's sitekey is part of every page that renders it. */
export const SITEKEY = '0x4AAAAAAFfEB-RvBz18M-UK';
/** Cloudflare's always-passing test sitekey — the real one is not issued for local hosts. */
export const TEST_SITEKEY = '1x00000000000000000000AA';
export const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Must equal worker/verify.ts ACTION: a token minted for another action is refused there. */
export const ACTION = 'legal_gate';
/** Nothing decided after this long (script slow or stuck) → let the visitor through. */
export const TIMEOUT_MS = 10_000;
/** Once the widget asks for a click, the person gets this long instead. */
export const INTERACTIVE_TIMEOUT_MS = 120_000;
/** Siteverify rejections answered with a fresh challenge before giving up. */
const MAX_ATTEMPTS = 3;
const VERIFY_TIMEOUT_MS = 8000;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export type HumanResult = 'passed' | 'unverified';

/** The slice of Cloudflare's `window.turnstile` this module uses. */
export interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string | null | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function sitekeyFor(hostname: string): string {
  return LOCAL_HOSTS.has(hostname) ? TEST_SITEKEY : SITEKEY;
}

let loading: Promise<TurnstileApi> | null = null;

/**
 * Injects api.js once. Callers that arrive while it loads share the one
 * request; once it settles `window.turnstile` is the source of truth, and a
 * failed load is forgotten so a later gate can try again.
 */
export function loadTurnstile(doc: Document = document): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.addEventListener('load', () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('turnstile: api.js loaded without an API'));
    });
    script.addEventListener('error', () => {
      script.remove();
      reject(new Error('turnstile: api.js blocked or offline'));
    });
    doc.head.append(script);
  }).finally(() => {
    loading = null;
  });
  return loading;
}

export interface CheckOptions {
  sitekey: string;
  theme: 'light' | 'dark';
  /** ISO 639-1, matching the page (`en` | `vi`): the widget speaks the site's language. */
  language: string;
  /** Test seams. */
  load?: () => Promise<TurnstileApi>;
  fetch?: typeof fetch;
  timeoutMs?: number;
  interactiveTimeoutMs?: number;
}

/** POST the token; the HTTP status, or 0 when the request itself failed. */
async function submit(token: string, f: typeof fetch): Promise<number> {
  try {
    const res = await f('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    return res.status;
  } catch {
    return 0;
  }
}

/**
 * Runs the check inside `container` and resolves exactly once:
 * - `passed` — Siteverify confirmed the token (worker answered 200);
 * - `unverified` — anything else: script blocked, widget error, timeout, a
 *   rejection that persisted for MAX_ATTEMPTS fresh challenges, or the
 *   Worker answering 429/503/unreachable.
 */
export function runHumanCheck(container: HTMLElement, opts: CheckOptions): Promise<HumanResult> {
  const post = opts.fetch ?? ((input, init) => fetch(input, init));
  return new Promise<HumanResult>((resolve) => {
    let api: TurnstileApi | undefined;
    let widgetId: string | undefined;
    let attempts = 0;
    let settled = false;
    let timer = setTimeout(() => finish('unverified'), opts.timeoutMs ?? TIMEOUT_MS);

    function finish(result: HumanResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (api && widgetId !== undefined) {
        try {
          api.remove(widgetId);
        } catch {
          // Already gone with its iframe — nothing left to clean up.
        }
      }
      resolve(result);
    }

    async function onToken(token: string): Promise<void> {
      attempts++;
      const status = await submit(token, post);
      if (status === 200) return finish('passed');
      if (status === 403 && attempts < MAX_ATTEMPTS && api && widgetId !== undefined) {
        // Rejected (spent, stale, minted elsewhere): a token is single-use,
        // so ask Turnstile for a fresh challenge rather than resubmitting.
        api.reset(widgetId);
        return;
      }
      finish('unverified');
    }

    (opts.load ?? loadTurnstile)().then(
      (turnstile) => {
        if (settled) return;
        api = turnstile;
        const id = turnstile.render(container, {
          sitekey: opts.sitekey,
          action: ACTION,
          theme: opts.theme,
          language: opts.language,
          appearance: 'interaction-only',
          // No <form> here: the token travels in our own request body.
          'response-field': false,
          // We give up on the first error; Turnstile retrying a widget we
          // are about to remove would only add console noise.
          retry: 'never',
          callback: (token: string) => void onToken(token),
          // Returning true tells Turnstile the error is handled — without an
          // error callback it THROWS, which the gate would surface as a page
          // error (and errors.js would file into bug reports).
          'error-callback': () => {
            finish('unverified');
            return true;
          },
          'unsupported-callback': () => finish('unverified'),
          'timeout-callback': () => finish('unverified'),
          'before-interactive-callback': () => {
            clearTimeout(timer);
            timer = setTimeout(
              () => finish('unverified'),
              opts.interactiveTimeoutMs ?? INTERACTIVE_TIMEOUT_MS,
            );
          },
        });
        if (typeof id === 'string') widgetId = id;
        else finish('unverified');
      },
      () => finish('unverified'),
    );
  });
}
