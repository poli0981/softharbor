// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// Two modules that are data rather than logic, pinned to the decisions behind
// them: one address per purpose on poli0981.dev (D27), and the single inline
// stylesheet whose hash astro.config.ts adds to style-src (check:csp holds
// the rendered element to it on every build).

import { describe, expect, it } from 'vitest';
import { CONTACTS } from './contacts';
import { VIEW_TRANSITION_OPT_IN } from './inlineCss';

describe('CONTACTS (D27)', () => {
  it('routes every purpose to its own poli0981.dev alias', () => {
    const addresses = Object.values(CONTACTS);
    for (const address of addresses) expect(address).toMatch(/^[a-z]+@poli0981\.dev$/);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it('offers no paid-placement or unrelated-project address', () => {
    const addresses = Object.values(CONTACTS).join(' ');
    expect(addresses).not.toContain('sponsor@');
    expect(addresses).not.toContain('games@');
  });
});

describe('VIEW_TRANSITION_OPT_IN', () => {
  it('opts into cross-document transitions only without a reduced-motion preference', () => {
    expect(VIEW_TRANSITION_OPT_IN).toBe(
      '@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}',
    );
  });
});
