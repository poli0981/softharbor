// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/05 §A3 — the /apps view as a URL.

import { describe, expect, it } from 'vitest';
import { parseViewState, serializeViewState, type ViewState } from './urlstate';

const EMPTY: ViewState = { q: '', categories: [], platforms: [], pricing: [], sort: null };

describe('parseViewState', () => {
  it('reads every field', () => {
    expect(
      parseViewState(
        '?q=trinh+duyet&cat=browser,security-privacy&platform=linux&pricing=free&sort=added',
      ),
    ).toEqual({
      q: 'trinh duyet',
      categories: ['browser', 'security-privacy'],
      platforms: ['linux'],
      pricing: ['free'],
      sort: 'added',
    });
  });

  it('is the empty view for an empty query string', () => {
    expect(parseViewState('')).toEqual(EMPTY);
  });

  it('drops values that are not slugs and de-duplicates the rest', () => {
    expect(parseViewState('?cat=browser,,<script>,browser,Media').categories).toEqual(['browser']);
  });

  it('ignores an unknown sort instead of trusting it', () => {
    expect(parseViewState('?sort=price').sort).toBeNull();
  });

  it('caps an absurdly long query', () => {
    expect(parseViewState(`?q=${'a'.repeat(5000)}`).q).toHaveLength(200);
  });
});

describe('serializeViewState', () => {
  it('writes nothing for the default view', () => {
    expect(serializeViewState(EMPTY)).toBe('');
    expect(serializeViewState({ ...EMPTY, sort: 'name' })).toBe('');
  });

  it('round-trips a full view with a stable key and value order', () => {
    const view: ViewState = {
      q: 'gimp',
      categories: ['media', 'graphics'],
      platforms: ['windows'],
      pricing: ['onetime', 'free'],
      sort: 'added',
    };
    const url = serializeViewState(view);
    expect(url).toBe(
      '?q=gimp&cat=graphics%2Cmedia&platform=windows&pricing=free%2Conetime&sort=added',
    );
    expect(parseViewState(url)).toEqual({
      ...view,
      categories: ['graphics', 'media'],
      pricing: ['free', 'onetime'],
    });
  });
});
