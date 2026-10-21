// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/07 §2 — Astro needs getStaticPaths in EVERY dynamic route file, and
// there are two per collection (EN + VI). Defining the builders once here and
// re-exporting them means a filter added to one locale can never silently
// skip the other.

import { getCollection } from 'astro:content';
import type { Locale } from '../i18n';
import { compareNames } from './filter';

interface Dated {
  data: { addedAt: string; name: string };
}

/**
 * Category pages: newest first, name as the tie-break — the /apps grid's
 * "Newest" order exactly (compareNames is the grid's pinned `en` collator).
 * It used to tie-break with a bare localeCompare(), i.e. in whatever locale
 * the BUILD machine's ICU defaults to, so a laptop, GitHub CI and Workers
 * Builds could each ship a different order.
 */
export function byAddedDesc(a: Dated, b: Dated): number {
  const byDate = b.data.addedAt < a.data.addedAt ? -1 : b.data.addedAt > a.data.addedAt ? 1 : 0;
  return byDate || compareNames(a.data.name, b.data.name);
}

function appPathsFor(locale: Locale) {
  return async () => {
    const apps = await getCollection('apps');
    return apps.map((app) => ({ params: { slug: app.id }, props: { app, locale } }));
  };
}

export const appPathsEn = appPathsFor('en');
export const appPathsVi = appPathsFor('vi');

function categoryPathsFor(locale: Locale) {
  return async () => {
    const categories = await getCollection('categories');
    return categories.map((category) => ({
      params: { id: category.id },
      props: { category, locale },
    }));
  };
}

export const categoryPathsEn = categoryPathsFor('en');
export const categoryPathsVi = categoryPathsFor('vi');
