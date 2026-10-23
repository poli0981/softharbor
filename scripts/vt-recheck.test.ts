// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// vt-recheck.mjs, driven in-process against a fake VirusTotal (the script
// takes `fetch` as a dependency, like worker/verify.ts), plus one real child
// run for the CLI path. That run gets NODE_V8_COVERAGE='' and VT_API_KEY='':
// Vitest merges a child's coverage of a file it also imported wrongly, and a
// developer's own key must never reach the real API from a test.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { project, run } from './fixture';
import {
  AuthError,
  canonicalUrl,
  decide,
  main,
  parseSlugs,
  patchSecurity,
  recheck,
  select,
  summary,
  urlId,
} from './vt-recheck.mjs';

const TODAY = '2026-10-23';
/** A check more than 90 days before TODAY: due by age alone. */
const STALE = '2026-06-01';
const GUI = 'https://www.virustotal.com/gui/url/';
const SEVEN_ZIP = readFileSync(join(process.cwd(), 'src/data/apps/7-zip.json'), 'utf8');

interface Security {
  status: 'clean' | 'unverified' | 'flagged';
  evidence: string | null;
  checkedAt: string;
}

/** An entry in the catalogue's own layout (Prettier: inline arrays). */
function entry(download: string, security: Partial<Security> = {}): string {
  const sec: Security = {
    status: 'clean',
    evidence: `${GUI}${urlId(download)}`,
    checkedAt: STALE,
    ...security,
  };
  return `{
  "name": "App",
  "developer": "Dev",
  "logo": "monogram",
  "summary": { "en": "An app used by tests to exercise the script.", "vi": "Ứng dụng dùng cho kiểm thử." },
  "categories": ["utilities"],
  "tags": ["portable"],
  "platforms": ["windows"],
  "pricing": "free",
  "license": null,
  "links": {
    "homepage": "https://example.test",
    "repo": null,
    "download": "${download}"
  },
  "security": {
    "status": "${sec.status}",
    "evidence": ${JSON.stringify(sec.evidence)},
    "checkedAt": "${sec.checkedAt}"
  },
  "addedAt": "2026-07-28"
}
`;
}

const dl = (slug: string) => `https://${slug}.example.test/download`;

function tree(files: Record<string, string>): { root: string; appsDir: string } {
  const prefixed = Object.fromEntries(
    Object.entries(files).map(([slug, text]) => [`src/data/apps/${slug}.json`, text]),
  );
  const root = project(prefixed);
  return { root, appsDir: join(root, 'src/data/apps') };
}

const read = (appsDir: string, slug: string) =>
  JSON.parse(readFileSync(join(appsDir, `${slug}.json`), 'utf8')) as { security: Security };

interface Verdict {
  malicious?: number;
  suspicious?: number;
  queued?: number; // reads that answer "queued" before "completed"
  submitStatus?: number; // HTTP status of the POST
  readStatus?: number;
  empty?: boolean; // every engine timed out
  noMeta?: boolean;
  id?: string; // URL id VirusTotal reports, if not the local hash
}

/** A fake VirusTotal v3: POST /urls and GET /analyses/{id}. */
function fakeVt(verdicts: Record<string, Verdict> = {}, opts: { status429?: number[] } = {}) {
  const calls: Array<{ method: string; path: string; key: string | null }> = [];
  const byAnalysis = new Map<string, { url: string; reads: number }>();
  let n = 0;
  const fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    n++;
    const url = new URL(input);
    const headers = new Headers(init.headers);
    calls.push({ method: init.method ?? 'GET', path: url.pathname, key: headers.get('x-apikey') });
    if (opts.status429?.includes(n))
      return Response.json({ error: { code: 'QuotaExceededError' } }, { status: 429 });

    if (init.method === 'POST' && url.pathname === '/api/v3/urls') {
      const target = new URLSearchParams(String(init.body)).get('url') ?? '';
      const v = verdicts[target] ?? {};
      if (v.submitStatus) return new Response('nope', { status: v.submitStatus });
      const id = `u-${urlId(target)}-1761177600`;
      byAnalysis.set(id, { url: target, reads: 0 });
      return Response.json({ data: { type: 'analysis', id } });
    }
    const match = /^\/api\/v3\/analyses\/(.+)$/.exec(url.pathname);
    const analysis = match ? byAnalysis.get(decodeURIComponent(match[1] ?? '')) : undefined;
    if (!analysis) return new Response('not found', { status: 404 });
    const v = verdicts[analysis.url] ?? {};
    if (v.readStatus) return new Response('nope', { status: v.readStatus });
    analysis.reads++;
    if (analysis.reads <= (v.queued ?? 0)) {
      return Response.json({ data: { attributes: { status: 'queued', stats: {} } } });
    }
    const stats = v.empty
      ? { harmless: 0, undetected: 0, malicious: 0, suspicious: 0, timeout: 90 }
      : {
          harmless: 60,
          undetected: 25,
          malicious: v.malicious ?? 0,
          suspicious: v.suspicious ?? 0,
        };
    return Response.json({
      data: { attributes: { status: 'completed', stats } },
      ...(v.noMeta
        ? {}
        : { meta: { url_info: { id: v.id ?? urlId(analysis.url), url: analysis.url } } }),
    });
  });
  return { fetch, calls };
}

function opts(appsDir: string, fetch: unknown, extra: Record<string, unknown> = {}) {
  return {
    appsDir,
    apiKey: 'test-key',
    fetch,
    sleep: vi.fn(async () => {}),
    now: () => 0,
    today: TODAY,
    intervalMs: 0,
    maxAge: 90,
    ...extra,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('canonicalUrl / urlId — VirusTotal URL identifiers', () => {
  it('reproduces the ids recorded in the catalogue', () => {
    // Three real entries: a plain page, a bare origin and a #fragment link.
    for (const slug of ['7-zip', 'homebrew', 'vlc']) {
      const app = JSON.parse(
        readFileSync(join(process.cwd(), `src/data/apps/${slug}.json`), 'utf8'),
      );
      expect(app.security.evidence, slug).toBe(`${GUI}${urlId(app.links.download)}`);
    }
  });

  it('lowercases the host, adds the root path, drops the fragment and keeps the query', () => {
    expect(canonicalUrl('HTTPS://Brew.SH')).toBe('https://brew.sh/');
    expect(canonicalUrl('https://www.videolan.org/vlc/#download')).toBe(
      'https://www.videolan.org/vlc/',
    );
    expect(canonicalUrl('https://x.test/get?os=win')).toBe('https://x.test/get?os=win');
    expect(canonicalUrl('https://x.test/download/')).not.toBe(
      canonicalUrl('https://x.test/download'),
    );
  });
});

describe('parseSlugs', () => {
  it('splits on spaces and commas, de-duplicates, and refuses non-slugs', () => {
    const log = vi.fn();
    expect(parseSlugs(' 7-zip,vlc  7-zip\nNot_A_Slug ; ', log)).toEqual(['7-zip', 'vlc']);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"Not_A_Slug"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('";"'));
    expect(parseSlugs(undefined)).toEqual([]);
  });
});

describe('patchSecurity', () => {
  it('changes the three security lines of a real entry and not one byte more', () => {
    const security = {
      status: 'unverified',
      evidence: `${GUI}${'f'.repeat(64)}`,
      checkedAt: TODAY,
    };
    const before = SEVEN_ZIP.split('\n');
    const after = patchSecurity(SEVEN_ZIP, security).split('\n');
    expect(after).toHaveLength(before.length);
    const changed = before.flatMap((line, i) => (line === after[i] ? [] : [after[i]]));
    expect(changed).toEqual([
      '    "status": "unverified",',
      `    "evidence": "${GUI}${'f'.repeat(64)}",`,
      `    "checkedAt": "${TODAY}"`,
    ]);
  });

  it('fills a never-scanned entry', () => {
    const text = entry(dl('a'), { status: 'unverified', evidence: null });
    const patched = patchSecurity(text, {
      status: 'unverified',
      evidence: `${GUI}abc`,
      checkedAt: TODAY,
    });
    expect(JSON.parse(patched).security).toEqual({
      status: 'unverified',
      evidence: `${GUI}abc`,
      checkedAt: TODAY,
    });
  });
});

describe('decide — the status rules', () => {
  it('keeps the status on a clean scan, and promotes only when asked', () => {
    expect(decide('clean', { malicious: 0 }, false)).toEqual({ status: 'clean', review: false });
    expect(decide('unverified', {}, false)).toEqual({ status: 'unverified', review: false });
    expect(decide('unverified', {}, true)).toEqual({ status: 'clean', review: false });
  });

  it('drops clean to unverified on any detection, and never flags', () => {
    expect(decide('clean', { suspicious: 1 }, false)).toEqual({
      status: 'unverified',
      review: true,
    });
    expect(decide('clean', { malicious: 3 }, true)).toEqual({ status: 'unverified', review: true });
    expect(decide('unverified', { malicious: 1 }, true)).toEqual({
      status: 'unverified',
      review: true,
    });
  });
});

describe('select — who is due, in order', () => {
  const make = (slug: string, security: Partial<Security>, download = dl(slug)) => ({
    slug,
    app: JSON.parse(entry(download, security)),
  });

  it('puts listed slugs first, then never-scanned, drifted and stale (oldest first)', () => {
    const entries = [
      make('fresh', { checkedAt: '2026-10-01' }),
      make('listed', { checkedAt: '2026-10-20' }),
      make('new-app', { status: 'unverified', evidence: null, checkedAt: TODAY }),
      make('drifted', { evidence: `${GUI}${urlId(dl('old-link'))}`, checkedAt: '2026-10-01' }),
      make('drift-recent', { evidence: `${GUI}${urlId(dl('old-link'))}`, checkedAt: '2026-10-20' }),
      make('stale-older', { checkedAt: '2026-06-01' }),
      make('stale', { checkedAt: '2026-07-01' }),
      make('advisory', {
        status: 'clean',
        evidence: 'https://vendor.test/advisory',
        checkedAt: '2026-10-01',
      }),
      make('flagged', { status: 'flagged', checkedAt: '2026-01-01' }),
    ];
    const order = select(entries, {
      slugs: ['listed', 'missing'],
      onlyListed: false,
      maxAge: 90,
      today: TODAY,
    });
    expect(order.map((e: { slug: string }) => e.slug)).toEqual([
      'listed',
      'new-app',
      'drifted',
      'stale-older',
      'stale',
    ]);
  });

  it('in preview, scans only the listed slugs — or the never-scanned when none are listed', () => {
    const entries = [make('a', {}), make('b', { status: 'unverified', evidence: null })];
    const pick = (slugs: string[]) =>
      select(entries, { slugs, onlyListed: true, maxAge: 0, today: TODAY }).map(
        (e: { slug: string }) => e.slug,
      );
    expect(pick(['a'])).toEqual(['a']);
    expect(pick([])).toEqual(['b']);
  });
});

describe('recheck — end to end against a fake VirusTotal', () => {
  it('refreshes evidence and checkedAt on a clean scan, sending the key', async () => {
    const { appsDir } = tree({ stale: entry(dl('stale')) });
    const vt = fakeVt();
    const report = await recheck(opts(appsDir, vt.fetch));

    expect(read(appsDir, 'stale').security).toEqual({
      status: 'clean',
      evidence: `${GUI}${urlId(dl('stale'))}`,
      checkedAt: TODAY,
    });
    expect(report).toMatchObject({ changed: 1, spent: 2, quotaHit: false, selected: 1 });
    expect(report.rows[0]).toMatchObject({
      slug: 'stale',
      kind: 'scanned',
      malicious: 0,
      mismatch: false,
    });
    expect(vt.calls.map((c) => `${c.method} ${c.path.replace(/[0-9a-f]{64}/, 'ID')}`)).toEqual([
      'POST /api/v3/urls',
      'GET /api/v3/analyses/u-ID-1761177600',
    ]);
    expect(vt.calls.every((c) => c.key === 'test-key')).toBe(true);
  });

  it('leaves entries that are not due untouched', async () => {
    const fresh = entry(dl('fresh'), { checkedAt: '2026-10-01' });
    const { appsDir } = tree({ fresh });
    const vt = fakeVt();
    const report = await recheck(opts(appsDir, vt.fetch));
    expect(report.changed).toBe(0);
    expect(vt.fetch).not.toHaveBeenCalled();
    expect(readFileSync(join(appsDir, 'fresh.json'), 'utf8')).toBe(fresh);
  });

  it('drops clean to unverified on a detection and reports it for review', async () => {
    const { appsDir } = tree({
      hit: entry(dl('hit')),
      held: entry(dl('held'), { status: 'unverified' }),
    });
    const vt = fakeVt({ [dl('hit')]: { malicious: 1 }, [dl('held')]: { suspicious: 2 } });
    const report = await recheck(opts(appsDir, vt.fetch));

    expect(read(appsDir, 'hit').security.status).toBe('unverified');
    expect(read(appsDir, 'held').security.status).toBe('unverified');
    expect(report.review.map((r: { slug: string }) => r.slug)).toEqual(['held', 'hit']);
    expect(report.review[1]).toMatchObject({ was: 'clean', status: 'unverified', malicious: 1 });
  });

  it('promotes only the listed unverified entries whose scan is clean', async () => {
    const { appsDir } = tree({
      'new-a': entry(dl('new-a'), { status: 'unverified', evidence: null, checkedAt: TODAY }),
      'new-b': entry(dl('new-b'), { status: 'unverified', evidence: null, checkedAt: TODAY }),
      'new-c': entry(dl('new-c'), { status: 'unverified', evidence: null, checkedAt: TODAY }),
    });
    const vt = fakeVt({ [dl('new-b')]: { malicious: 1 } });
    await recheck(opts(appsDir, vt.fetch, { promote: ['new-a', 'new-b'] }));
    expect(read(appsDir, 'new-a').security.status).toBe('clean');
    expect(read(appsDir, 'new-b').security.status).toBe('unverified');
    expect(read(appsDir, 'new-c').security).toMatchObject({
      status: 'unverified',
      evidence: `${GUI}${urlId(dl('new-c'))}`,
    });
  });

  it('spends at most half the budget on submissions', async () => {
    const { appsDir } = tree({ a: entry(dl('a')), b: entry(dl('b')), c: entry(dl('c')) });
    const vt = fakeVt();
    const report = await recheck(opts(appsDir, vt.fetch, { budget: 4 }));
    expect(report.spent).toBe(4);
    expect(report.rows.find((r: { slug: string }) => r.slug === 'c')).toMatchObject({
      kind: 'skipped',
      reason: 'budget',
    });
    expect(read(appsDir, 'c').security.checkedAt).toBe(STALE);
  });

  it('re-reads an analysis that is still queued, up to three times', async () => {
    const { appsDir } = tree({ slow: entry(dl('slow')), stuck: entry(dl('stuck')) });
    const vt = fakeVt({ [dl('slow')]: { queued: 2 }, [dl('stuck')]: { queued: 9 } });
    const report = await recheck(opts(appsDir, vt.fetch));
    expect(read(appsDir, 'slow').security.checkedAt).toBe(TODAY);
    expect(report.rows.find((r: { slug: string }) => r.slug === 'stuck')).toMatchObject({
      kind: 'error',
      reason: 'analysis still queued',
    });
    expect(read(appsDir, 'stuck').security.checkedAt).toBe(STALE);
  });

  it('backs off once on 429, then treats a second 429 as the spent daily quota', async () => {
    const { appsDir } = tree({ a: entry(dl('a')), b: entry(dl('b')), c: entry(dl('c')) });
    // Request 1 (submit a) is limited once and retried; request 4 (submit c)
    // and its retry are both refused — the day's quota is gone.
    const vt = fakeVt({}, { status429: [1, 4, 5] });
    const o = opts(appsDir, vt.fetch);
    const report = await recheck(o);

    expect(o.sleep).toHaveBeenCalledWith(60_000);
    expect(report.quotaHit).toBe(true);
    expect(report.rows.find((r: { slug: string }) => r.slug === 'c')).toMatchObject({
      kind: 'error',
      reason: 'daily quota',
    });
    // a and b were submitted before the quota ran out, but their reads come
    // after it: nothing is guessed, nothing is written for them.
    expect(report.rows.filter((r: { kind: string }) => r.kind === 'skipped')).toHaveLength(2);
    expect(report.changed).toBe(0);
  });

  it('stops everything on a refused API key, writing nothing', async () => {
    const text = entry(dl('a'));
    const { appsDir } = tree({ a: text });
    const fetch = vi.fn(async () => new Response('denied', { status: 401 }));
    await expect(recheck(opts(appsDir, fetch))).rejects.toBeInstanceOf(AuthError);
    expect(readFileSync(join(appsDir, 'a.json'), 'utf8')).toBe(text);
  });

  it('records a failed URL as not checked and carries on', async () => {
    const { appsDir } = tree({
      bad: entry(dl('bad')),
      good: entry(dl('good')),
      odd: entry(dl('odd')),
    });
    const vt = fakeVt({ [dl('bad')]: { submitStatus: 400 }, [dl('odd')]: { readStatus: 500 } });
    const report = await recheck(opts(appsDir, vt.fetch));
    expect(report.rows.find((r: { slug: string }) => r.slug === 'bad')).toMatchObject({
      kind: 'error',
      reason: 'HTTP 400',
    });
    expect(report.rows.find((r: { slug: string }) => r.slug === 'odd')).toMatchObject({
      kind: 'error',
      reason: 'HTTP 500',
    });
    expect(read(appsDir, 'good').security.checkedAt).toBe(TODAY);
    expect(report.changed).toBe(1);
  });

  it('refuses an analysis in which no engine answered', async () => {
    const { appsDir } = tree({ a: entry(dl('a')) });
    const report = await recheck(opts(appsDir, fakeVt({ [dl('a')]: { empty: true } }).fetch));
    expect(report.rows[0]).toMatchObject({ kind: 'error', reason: 'no engine returned a verdict' });
    expect(report.changed).toBe(0);
  });

  it("takes the URL id from the analysis id when `meta` is missing, and flags an id it can't reproduce", async () => {
    const { appsDir } = tree({ a: entry(dl('a')), b: entry(dl('b')) });
    const log = vi.fn();
    const vt = fakeVt({ [dl('a')]: { noMeta: true }, [dl('b')]: { id: 'e'.repeat(64) } });
    const report = await recheck(opts(appsDir, vt.fetch, { log }));
    expect(read(appsDir, 'a').security.evidence).toBe(`${GUI}${urlId(dl('a'))}`);
    expect(read(appsDir, 'b').security.evidence).toBe(`${GUI}${'e'.repeat(64)}`);
    expect(report.rows.find((r: { slug: string }) => r.slug === 'b')).toMatchObject({
      mismatch: true,
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("b: VirusTotal's URL id differs"));
  });

  it('paces requests at the configured interval', async () => {
    const { appsDir } = tree({ a: entry(dl('a')), b: entry(dl('b')) });
    let clock = 0;
    const sleep = vi.fn(async (ms: number) => {
      clock += ms;
    });
    await recheck(opts(appsDir, fakeVt().fetch, { intervalMs: 15_500, now: () => clock, sleep }));
    expect(sleep).toHaveBeenCalledTimes(3); // 4 requests, the first one unpaced
    expect(sleep.mock.calls.every(([ms]) => ms === 15_500)).toBe(true);
  });

  it('skips files that are not catalogue entries', async () => {
    const log = vi.fn();
    const { appsDir } = tree({ broken: '{ nope', partial: '{"name": "x"}' });
    const report = await recheck(opts(appsDir, fakeVt().fetch, { log }));
    expect(report.selected).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('unparseable broken.json'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('skipping partial.json'));
  });
});

describe('carry — accumulating in the open re-check PR', () => {
  it('adopts newer scans of the same link, so they are not re-scanned', async () => {
    const { appsDir } = tree({
      done: entry(dl('done')),
      moved: entry(dl('moved')),
      older: entry(dl('older')),
      flagged: entry(dl('flagged')),
      junk: entry(dl('junk')),
    });
    const carried = project({
      'done.json': entry(dl('done'), { status: 'unverified', checkedAt: '2026-10-22' }),
      'moved.json': entry(dl('moved-elsewhere'), { checkedAt: '2026-10-22' }),
      'older.json': entry(dl('older'), { checkedAt: '2026-05-01' }),
      'flagged.json': entry(dl('flagged'), { status: 'flagged', checkedAt: '2026-10-22' }),
      'junk.json': '{ nope',
    });
    const vt = fakeVt();
    const report = await recheck(opts(appsDir, vt.fetch, { carryDir: carried }));

    expect(report.carried).toEqual(['done']);
    expect(read(appsDir, 'done').security).toMatchObject({
      status: 'unverified',
      checkedAt: '2026-10-22',
    });
    // Everything else was still due and got a fresh scan of ITS link.
    expect(report.rows.map((r: { slug: string }) => r.slug).sort()).toEqual([
      'flagged',
      'junk',
      'moved',
      'older',
    ]);
    expect(read(appsDir, 'moved').security.evidence).toBe(`${GUI}${urlId(dl('moved'))}`);
  });

  it('is a no-op without a carry tree', async () => {
    const { appsDir } = tree({ a: entry(dl('a')) });
    const report = await recheck(
      opts(appsDir, fakeVt().fetch, { carryDir: join(appsDir, 'none') }),
    );
    expect(report.carried).toEqual([]);
  });
});

describe('summary — the PR body', () => {
  it('lists every row, the review set, carried entries and a quota stop', () => {
    const text = summary(
      {
        rows: [
          {
            slug: 'a',
            kind: 'scanned',
            evidence: `${GUI}aa`,
            malicious: 0,
            suspicious: 0,
            was: 'clean',
            status: 'clean',
            mismatch: false,
          },
          {
            slug: 'b',
            kind: 'scanned',
            evidence: `${GUI}bb`,
            malicious: 2,
            suspicious: 1,
            was: 'clean',
            status: 'unverified',
            review: true,
            mismatch: true,
          },
          { slug: 'c', kind: 'skipped', reason: 'budget' },
        ],
        review: [{ slug: 'b' }],
        carried: ['d'],
        spent: 5,
        quotaHit: true,
        selected: 4,
      },
      { today: TODAY },
    );
    expect(text).toContain('- scanned: 2 of 4 due · requests: 5 · **stopped at the daily quota**');
    expect(text).toContain('- needs review (detections): 1 — `b`');
    expect(text).toContain('- carried from the open re-check PR: 1 (d)');
    expect(text).toContain(`| \`a\` | no detections | clean | [scan](${GUI}aa) |`);
    expect(text).toContain(
      '| `b` | ⚠ 2 malicious, 1 suspicious · id ≠ local hash | clean → **unverified** |',
    );
    expect(text).toContain('| `c` | not checked (budget) | — | — |');
    expect(text).toContain('not a safety guarantee');
  });
});

describe('main — the CLI wrapper', () => {
  it('writes the report, the review list and the step outputs', async () => {
    const { root, appsDir } = tree({ hit: entry(dl('hit')), ok: entry(dl('ok')) });
    vi.stubGlobal('fetch', fakeVt({ [dl('hit')]: { malicious: 1 } }).fetch);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const env = {
      VT_API_KEY: 'k',
      VT_INTERVAL_MS: '0',
      VT_SLUGS: 'ok, hit',
      VT_BUDGET: 'lots',
      GITHUB_OUTPUT: join(root, 'out.txt'),
      VT_SUMMARY: join(root, 'summary.md'),
      VT_REVIEW_JSON: join(root, 'review.json'),
    };
    expect(await main(env, root)).toBe(0);
    expect(readFileSync(env.GITHUB_OUTPUT, 'utf8')).toBe('changed=2\nreview=hit\n');
    expect(readFileSync(env.VT_SUMMARY, 'utf8')).toContain('needs review (detections): 1');
    expect(JSON.parse(readFileSync(env.VT_REVIEW_JSON, 'utf8'))[0]).toMatchObject({
      slug: 'hit',
      malicious: 1,
      evidence: `${GUI}${urlId(dl('hit'))}`,
    });
    expect(read(appsDir, 'ok').security.checkedAt).toBe(new Date().toISOString().slice(0, 10));
  });

  it('fails the step on a refused key, reporting no changes', async () => {
    const { root } = tree({ a: entry(dl('a')) });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 403 })),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { VT_API_KEY: 'k', VT_INTERVAL_MS: '0', GITHUB_OUTPUT: join(root, 'out.txt') };
    expect(await main(env, root)).toBe(1);
    expect(readFileSync(env.GITHUB_OUTPUT, 'utf8')).toBe('changed=0\nreview=\n');
  });

  it('runs as a script: without a key it says so and changes nothing', () => {
    const text = entry(dl('a'));
    const { root, appsDir } = tree({ a: text });
    const r = run('vt-recheck.mjs', root, {
      env: { NODE_V8_COVERAGE: '', VT_API_KEY: '', GITHUB_OUTPUT: join(root, 'out.txt') },
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain('VT_API_KEY is not set');
    expect(readFileSync(join(root, 'out.txt'), 'utf8')).toBe('changed=0\nreview=\n');
    expect(readFileSync(join(appsDir, 'a.json'), 'utf8')).toBe(text);
  });
});
