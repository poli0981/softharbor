// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// docs/05 §A2 — build-time MiniSearch factory. The options live in
// ./searchOptions so the client can share them without statically bundling
// MiniSearch; they are re-exported here for existing callers.

import MiniSearch from 'minisearch';
import { miniSearchOptions, type SearchDoc } from './searchOptions';

export { FUZZY, miniSearchOptions, type SearchDoc } from './searchOptions';

export function buildIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const mini = new MiniSearch<SearchDoc>(miniSearchOptions as never);
  mini.addAll(docs);
  return mini;
}
