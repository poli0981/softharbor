// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/07 §2 — Astro needs getStaticPaths in EVERY dynamic route file, and
// there are two per collection (EN + VI). Defining the builders once here and
// re-exporting them means a filter added to one locale can never silently
// skip the other.

import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n';

export interface AppPathProps {
  app: CollectionEntry<'apps'>;
  locale: Locale;
}

/** Sort helper shared by grid and feed: newest first, name as tiebreak. */
export function byAddedDesc(a: CollectionEntry<'apps'>, b: CollectionEntry<'apps'>): number {
  return b.data.addedAt.localeCompare(a.data.addedAt) || a.data.name.localeCompare(b.data.name);
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
