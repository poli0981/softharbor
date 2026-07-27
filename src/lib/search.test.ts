// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
// Spike S2 — docs/11 §2/§3.

import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import { buildIndex, FUZZY, miniSearchOptions, type SearchDoc } from './search';

const FIXTURE: SearchDoc[] = [
  {
    slug: 'firefox',
    name: 'Firefox',
    tags: ['browser', 'privacy'],
    summaryEn: 'Open-source web browser from Mozilla with strong privacy defaults.',
    summaryVi: 'Trình duyệt web mã nguồn mở của Mozilla với thiết lập riêng tư mạnh.',
  },
  {
    slug: 'brave',
    name: 'Brave',
    tags: ['browser'],
    summaryEn: 'Chromium-based web browser that blocks trackers by default.',
    summaryVi: 'Trình duyệt nền Chromium chặn trình theo dõi theo mặc định.',
  },
  {
    slug: 'gimp',
    name: 'GIMP',
    tags: ['image-editing'],
    summaryEn: 'Raster graphics editor for photo retouching and image composition.',
    summaryVi: 'Trình chỉnh sửa ảnh raster dùng cho hậu kỳ và ghép ảnh.',
  },
  {
    slug: 'sharex',
    name: 'ShareX',
    tags: ['screenshot', 'capture'],
    summaryEn: 'Screen capture and screenshot tool with configurable upload targets.',
    summaryVi: 'Công cụ chụp màn hình với tuỳ chọn tải lên linh hoạt.',
  },
  {
    slug: '7-zip',
    name: '7-Zip',
    tags: ['archiver', 'compression'],
    summaryEn: 'File archiver with high-ratio 7z compression.',
    summaryVi: 'Trình nén tệp với định dạng 7z tỷ lệ nén cao.',
  },
];

const mini = buildIndex(FIXTURE);
const slugs = (q: string, mi = mini): string[] => mi.search(q).map((r) => String(r.id));

describe('search — Vietnamese queries (docs/07 §7)', () => {
  it('finds browsers from unaccented Vietnamese', () => {
    expect(slugs('trinh duyet')).toEqual(expect.arrayContaining(['firefox', 'brave']));
  });

  it('returns the same set for accented, unaccented, upper, and NFD forms', () => {
    const base = [...slugs('trinh duyet')].sort();
    for (const variant of ['trình duyệt', 'TRINH DUYET', 'trình duyệt'.normalize('NFD')]) {
      expect([...slugs(variant)].sort()).toEqual(base);
    }
  });

  it('searches across locales regardless of UI language', () => {
    expect(slugs('screenshot')).toContain('sharex'); // EN query
    expect(slugs('chup man hinh')).toContain('sharex'); // VI query, same app
  });
});

describe('search — matching behavior', () => {
  it('prefix: "fire" finds Firefox', () => {
    expect(slugs('fire')).toContain('firefox');
  });

  it('AND semantics across terms', () => {
    expect(slugs('web browser')).toEqual(expect.arrayContaining(['firefox', 'brave']));
    expect(slugs('browser archiver')).toHaveLength(0);
  });

  it('tags are searchable (extractField flattens the array)', () => {
    expect(slugs('compression')).toContain('7-zip');
  });

  it('index survives a toJSON/loadJSON round-trip', () => {
    const revived = MiniSearch.loadJSON<SearchDoc>(
      JSON.stringify(mini),
      miniSearchOptions as never,
    );
    expect(slugs('trinh duyet', revived).sort()).toEqual(slugs('trinh duyet').sort());
  });
});

describe('search — fuzzy constant (the reason S2 exists)', () => {
  const at = (fuzzy: number, q: string): string[] =>
    mini.search(q, { fuzzy, prefix: true, combineWith: 'AND' }).map((r) => String(r.id));

  it('catches realistic typos at the chosen FUZZY', () => {
    expect(at(FUZZY, 'gimo')).toContain('gimp'); // 1 edit, 4 chars
    expect(at(FUZZY, 'fierfox')).toContain('firefox'); // transposition, 7 chars
  });

  it('keeps correctly-spelled queries exact — the precision guard', () => {
    // This is the test that stops anyone "fixing" a fuzzy miss by turning the
    // constant up. Both of these degrade at fuzzy >= 0.375.
    expect(at(FUZZY, 'gimp')).toEqual(['gimp']);
    expect(at(FUZZY, 'archiver')).toEqual(['7-zip']);
  });

  it('documents why the gmip → GIMP vector was retired (docs/11 §2)', () => {
    // `gmip` is a transposition: 2 edits on a 4-char term, so it needs
    // fuzzy >= 0.375. At that setting the correct spelling stops being exact,
    // which is a worse bug than missing one contrived typo.
    expect(at(FUZZY, 'gmip')).not.toContain('gimp');
    expect(at(0.375, 'gmip')).toContain('gimp');
    expect(at(0.375, 'gimp')).not.toEqual(['gimp']); // the cost, pinned
  });
});
