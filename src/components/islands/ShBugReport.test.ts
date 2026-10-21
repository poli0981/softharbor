// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// ShBugReport — a plain link whose prefilled GitHub URL is built at the last
// moment (hover / focus / click), from the page and the ring buffer as they
// are THEN. Nothing is sent anywhere until the visitor submits on GitHub.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ShBugReport from './ShBugReport.svelte';

let app: Record<string, unknown> | undefined;
let link: HTMLAnchorElement;

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.lang = 'vi';
  history.replaceState(null, '', '/vi/apps?q=gimp');
  const target = document.createElement('div');
  document.body.appendChild(target);
  app = mount(ShBugReport, { target, props: { label: 'Báo lỗi', countLabel: '{n} lỗi' } });
  flushSync();
  link = document.querySelector<HTMLAnchorElement>('[data-testid="sh-bug-report"]')!;
});

afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  Reflect.deleteProperty(globalThis, '__shErrors');
});

describe('ShBugReport', () => {
  it('is an inert link until the visitor reaches for it', () => {
    expect(link.getAttribute('href')).toBe('#');
    expect(link.getAttribute('rel')).toBe('noopener');
    expect(link.textContent?.trim()).toBe('Báo lỗi');
  });

  it('prefills the issue form with the page as it is on focus', () => {
    link.dispatchEvent(new FocusEvent('focus'));
    flushSync();
    const url = new URL(link.href);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://github.com/poli0981/softharbor/issues/new',
    );
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('page-url')).toBe(location.href);
    expect(url.searchParams.get('environment')).toContain('lang=vi');
    expect(url.searchParams.get('console-output')).toBe('(buffer empty)');
  });

  it('shows how many errors the buffer caught, and sends them along', () => {
    (globalThis as Record<string, unknown>)['__shErrors'] = ['[error] a', '[error] b'];
    link.dispatchEvent(new MouseEvent('mouseenter'));
    flushSync();
    expect(link.textContent).toContain('(2 lỗi)');
    expect(new URL(link.href).searchParams.get('console-output')).toBe('[error] a\n[error] b');
  });
});
