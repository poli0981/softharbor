// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/05 §A2 — MiniSearch factory. Options are shared verbatim between the
// build-time indexer (src/pages/search-index.json.ts) and the client island,
// so the two can never drift.

import MiniSearch from 'minisearch';
import { normalizeViet } from './normalize';

export interface SearchDoc {
  slug: string;
  name: string;
  tags: string[];
  summaryEn: string;
  summaryVi: string;
}

/**
 * Fuzzy distance as a fraction of term length. MiniSearch turns this into
 * `round(term.length * FUZZY)` edits, so it scales with query length.
 *
 * Set by measurement in spike S2 (2026-07-27), not by guess. The sweep:
 *
 *   fuzzy   gmip         gimo          fierfox   archiver          gimp
 *   0.15    -            gimp          -         7-zip             gimp
 *   0.25    -            gimp          firefox   7-zip             gimp
 *   0.375   gimp,7-zip   gimp,firefox  firefox   7-zip             gimp,7-zip
 *   0.6     gimp,7-zip   gimp,firefox  firefox   7-zip,brave,gimp  gimp,7-zip
 *
 * docs/11 §2 originally demanded `gmip` → GIMP. That needs 2 edits on a
 * 4-character term (it is a transposition), i.e. fuzzy ≥ 0.375 — and the same
 * row shows the cost: at 0.375 the *correctly spelled* query `gimp` also
 * starts returning 7-Zip. Two edits on a four-letter word matches a large
 * slice of any dictionary, so precision collapses exactly where users are
 * most confident they typed the right thing.
 *
 * 0.25 is the knee: 1 edit on short terms, 2 on terms of 6+ characters. It
 * catches realistic typos (`gimo` → GIMP, `fierfox` → Firefox) while exact
 * queries stay exact. The `gmip` vector was replaced accordingly — it asked
 * for a behavior that is not worth its false positives.
 */
export const FUZZY = 0.25;

export const miniSearchOptions = {
  idField: 'slug',
  // Raw fields — processTerm normalizes at index time AND query time, so the
  // serialized index on disk is already normalized. No *Norm duplicates.
  fields: ['name', 'tags', 'summaryEn', 'summaryVi'],
  // No storeFields: MiniSearch returns the id anyway and display data lives
  // in the DOM (docs/05 §A3).
  extractField: (doc: Record<string, unknown>, field: string): string => {
    const v = doc[field];
    return Array.isArray(v) ? v.join(' ') : ((v as string | undefined) ?? '');
  },
  processTerm: (t: string): string | null => {
    const n = normalizeViet(t);
    return n.length > 0 ? n : null;
  },
  searchOptions: {
    prefix: true,
    fuzzy: FUZZY,
    boost: { name: 3, tags: 2, summaryEn: 1, summaryVi: 1 },
    combineWith: 'AND' as const,
  },
} as const;

export function buildIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const mini = new MiniSearch<SearchDoc>(miniSearchOptions as never);
  mini.addAll(docs);
  return mini;
}
