// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * VirusTotal re-check — docs/09 §6 step 5 made assisted, docs/12 §4b.
 *
 * Every entry's security line is a DATED claim ("no known warnings as of
 * <checkedAt>", hard rule 4), so it is only honest while the date is recent.
 * This re-scans each entry's `links.download` page on VirusTotal and rewrites
 * ONLY its three security lines:
 *
 *   - no engine reports it malicious or suspicious → fresh `evidence` and
 *     `checkedAt`, status unchanged. A slug the maintainer lists in
 *     VT_PROMOTE goes `unverified` → `clean`: that is their docs/09 §6 call,
 *     never the script's;
 *   - any detection → a `clean` entry drops to `unverified` (it no longer has
 *     "no known warnings") and is reported for a tracking issue; an
 *     `unverified` entry just gets the fresh scan.
 *
 * It never sets `flagged` — quarantine stays a human `pnpm quarantine`
 * (hard rule 5) — and never touches `addedAt`/`updatedAt`: the feed orders by
 * addedAt and notify.py announces whatever it has not seen (docs/13 §5).
 * Files are patched line by line, not re-serialised, so Prettier's layout
 * survives byte for byte.
 *
 * Callers: .github/workflows/vt-recheck.yml — daily on main (a PR accumulates
 * the results), or dispatched on a data branch as a preview — and a
 * maintainer with VT_API_KEY set. Options come from the environment so a
 * workflow never interpolates input into a command line:
 *
 *   VT_API_KEY      required; without it the run is a no-op that says so
 *   VT_SLUGS        scan these first (space or comma separated)
 *   VT_PROMOTE      move these unverified → clean if their scan is clean
 *   VT_ONLY_LISTED  "1": scan only VT_SLUGS — or, if empty, the entries that
 *                   have never been scanned (a data PR's new apps)
 *   VT_MAX_AGE      re-scan checks older than this many days (default 90)
 *   VT_BUDGET       requests this run may spend (default 440, at most 500)
 *   VT_CARRY        data dir of the still-open re-check PR (see carry())
 *   VT_SUMMARY      write the markdown report here (the PR body)
 *   VT_REVIEW_JSON  write the detections here, for the issue step
 *   VT_INTERVAL_MS  pacing between requests (default 15 500 — tests set 0)
 *
 * Public API limits: 4 requests a minute and 500 a day, and VirusTotal counts
 * every call. One URL costs a submission plus at least one read, so at most
 * half the budget is spent on submissions — the reads must always fit.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://www.virustotal.com/api/v3';
const GUI = 'https://www.virustotal.com/gui/url/';
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EVIDENCE_RE = /^https:\/\/www\.virustotal\.com\/gui\/url\/([0-9a-f]{64})$/;
const DAY_MS = 86_400_000;
/** A drifted scan is re-run at most weekly, so a canonicalisation miss costs ≤ 2 requests a week. */
const DRIFT_GRACE_DAYS = 7;
const MAX_POLLS = 3;
const QUOTA_BACKOFF_MS = 60_000;
const DEFAULTS = { maxAge: 90, budget: 440, intervalMs: 15_500 };

/** The API key was refused: nothing else this run does can succeed. */
export class AuthError extends Error {}

/**
 * VirusTotal's URL identifier is the SHA-256 of its canonical form. WHATWG
 * parsing does what the catalogue's 326 recorded scans show it does:
 * lowercase scheme and host, an empty path becomes "/", the query is kept —
 * and the fragment, which a browser never sends, is dropped.
 */
export function canonicalUrl(raw) {
  const url = new URL(raw);
  url.hash = '';
  return url.href;
}

export const urlId = (raw) => createHash('sha256').update(canonicalUrl(raw)).digest('hex');

const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** Slugs from "a b,c" — invalid ones are reported, never passed on. */
export function parseSlugs(value, log = () => {}) {
  const slugs = [];
  for (const s of String(value ?? '').split(/[\s,]+/)) {
    if (!s) continue;
    if (SLUG_RE.test(s)) slugs.push(s);
    else log(`vt-recheck: ignoring "${s}" — not a valid slug`);
  }
  return [...new Set(slugs)];
}

/**
 * Rewrites the three lines of the `security` object and nothing else. The
 * object holds no nested braces (docs/04 §2), so `[^}]*` cannot overrun it.
 */
export function patchSecurity(text, security) {
  return text.replace(/("security":\s*\{)([^}]*)(\})/, (_, open, body, close) => {
    const next = body
      .replace(/("status":\s*)"[^"]*"/, `$1"${security.status}"`)
      .replace(/("evidence":\s*)(?:null|"[^"]*")/, `$1${JSON.stringify(security.evidence)}`)
      .replace(/("checkedAt":\s*)"[^"]*"/, `$1"${security.checkedAt}"`);
    return open + next + close;
  });
}

/** Everything but `security`, for proving a patch touched nothing else. */
const rest = (app) => JSON.stringify({ ...app, security: undefined });

function loadEntries(appsDir, log) {
  if (!existsSync(appsDir)) return [];
  const entries = [];
  for (const file of readdirSync(appsDir).filter((f) => f.endsWith('.json'))) {
    const slug = file.slice(0, -'.json'.length);
    const path = join(appsDir, file);
    const text = readFileSync(path, 'utf8');
    try {
      const app = JSON.parse(text);
      if (SLUG_RE.test(slug) && app?.security && app?.links?.download) {
        entries.push({ slug, path, text, app });
      } else log(`vt-recheck: skipping ${file} — not a catalogue entry`);
    } catch (e) {
      log(`vt-recheck: skipping unparseable ${file}: ${e.message}`);
    }
  }
  return entries.sort((a, b) => (a.slug < b.slug ? -1 : 1));
}

/**
 * The daily run lands in ONE pull request that stays open until merged. Its
 * branch holds the earlier days' results; without this, every run would
 * re-scan the same stalest entries, because main still shows them as stale.
 * A carried security block is adopted only when the download link it scanned
 * is still the one on main and its check is newer than main's.
 */
export function carry(entries, carryDir) {
  const carried = [];
  if (!carryDir || !existsSync(carryDir)) return carried;
  for (const entry of entries) {
    const path = join(carryDir, `${entry.slug}.json`);
    if (!existsSync(path)) continue;
    let theirs;
    try {
      theirs = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      continue;
    }
    const sec = theirs?.security;
    if (
      theirs?.links?.download !== entry.app.links.download ||
      typeof sec?.checkedAt !== 'string' ||
      !(sec.checkedAt > entry.app.security.checkedAt) ||
      sec.status === 'flagged'
    ) {
      continue;
    }
    const security = {
      status: sec.status,
      evidence: sec.evidence ?? null,
      checkedAt: sec.checkedAt,
    };
    entry.text = patchSecurity(entry.text, security);
    entry.app = { ...entry.app, security };
    entry.dirty = true;
    carried.push(entry.slug);
  }
  return carried;
}

/** True when the linked scan is of some other URL than today's download link. */
function drifted(entry) {
  const id = EVIDENCE_RE.exec(entry.app.security.evidence ?? '')?.[1];
  return id !== undefined && id !== urlId(entry.app.links.download);
}

/** Who gets scanned this run, in priority order. */
export function select(entries, { slugs, onlyListed, maxAge, today }) {
  const bySlug = new Map(entries.map((e) => [e.slug, e]));
  const listed = slugs.map((s) => bySlug.get(s)).filter(Boolean);
  const scannable = entries.filter((e) => e.app.security.status !== 'flagged');
  const neverScanned = scannable.filter((e) => e.app.security.evidence === null);
  if (onlyListed) return listed.length > 0 ? listed : neverScanned;

  const age = (e) => daysBetween(e.app.security.checkedAt, today);
  const due = [
    ...listed,
    ...neverScanned,
    ...scannable.filter((e) => drifted(e) && age(e) >= DRIFT_GRACE_DAYS),
    // Oldest check first; Array#sort is stable, so equal dates keep slug order.
    ...scannable.filter((e) => age(e) > maxAge).sort((a, b) => age(b) - age(a)),
  ];
  return [...new Set(due)];
}

/** The VirusTotal client: pacing, the request budget, and the quota rules. */
function client({ apiKey, fetch, sleep, now, intervalMs, budget }) {
  let spent = 0;
  let last = -Infinity;
  const state = { quotaHit: false };

  async function once(method, path, body) {
    const wait = last + intervalMs - now();
    if (wait > 0) await sleep(wait);
    last = now();
    spent++;
    return fetch(`${API}${path}`, {
      method,
      headers: {
        'x-apikey': apiKey,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(body ? { body } : {}),
    });
  }

  /** One API call, with a single back-off on 429 (the per-minute limit). */
  async function call(method, path, body) {
    let res = await once(method, path, body);
    if (res.status === 429 && spent < budget) {
      await sleep(QUOTA_BACKOFF_MS);
      res = await once(method, path, body);
    }
    if (res.status === 429) {
      state.quotaHit = true;
      throw new Error('quota exceeded');
    }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(`VirusTotal refused the API key (HTTP ${res.status})`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  return {
    state,
    left: () => budget - spent,
    spent: () => spent,
    /** POST /urls → the analysis id. */
    submit: async (url) =>
      (await call('POST', '/urls', `url=${encodeURIComponent(url)}`))?.data?.id,
    /** GET /analyses/{id} → `{ data: { attributes }, meta: { url_info } }`. */
    read: async (id) => call('GET', `/analyses/${encodeURIComponent(id)}`),
  };
}

const why = (vt, e) => (vt.state.quotaHit ? 'daily quota' : e.message);

/** Pass 1: submit the queue, keeping half the budget for the reads. */
async function submitAll(vt, queue, outcome) {
  const pending = [];
  const most = Math.floor(vt.left() / 2);
  for (const entry of queue) {
    if (vt.state.quotaHit || pending.length >= most) {
      outcome(entry, { kind: 'skipped', reason: vt.state.quotaHit ? 'daily quota' : 'budget' });
      continue;
    }
    try {
      const id = await vt.submit(entry.app.links.download);
      if (typeof id !== 'string') throw new Error('no analysis id');
      pending.push({ entry, id, polls: 0 });
    } catch (e) {
      if (e instanceof AuthError) throw e;
      outcome(entry, { kind: 'error', reason: why(vt, e) });
    }
  }
  return pending;
}

/** Pass 2: read each analysis; one still queued goes to the back of the line. */
async function readAll(vt, pending, outcome) {
  while (pending.length > 0) {
    const item = pending.shift();
    if (vt.state.quotaHit || vt.left() < 1) {
      outcome(item.entry, {
        kind: 'skipped',
        reason: vt.state.quotaHit ? 'daily quota' : 'budget',
      });
      continue;
    }
    try {
      const body = await vt.read(item.id);
      const attributes = body?.data?.attributes;
      if (attributes?.status !== 'completed') {
        item.polls++;
        if (item.polls < MAX_POLLS) pending.push(item);
        else outcome(item.entry, { kind: 'error', reason: 'analysis still queued' });
        continue;
      }
      // The URL's id rides along in `meta`; the analysis id ("u-<sha256>-<ts>")
      // carries it too, should `meta` ever be missing.
      const id = body?.meta?.url_info?.id ?? /^u-([0-9a-f]{64})-\d+$/.exec(item.id)?.[1];
      if (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id)) throw new Error('no URL id');
      const stats = attributes.stats ?? {};
      const verdicts = ['harmless', 'undetected', 'malicious', 'suspicious'];
      // Every engine timing out is not "no detections" — it is no answer.
      if (verdicts.every((k) => !stats[k])) throw new Error('no engine returned a verdict');
      outcome(item.entry, { kind: 'scanned', id, stats });
    } catch (e) {
      if (e instanceof AuthError) throw e;
      outcome(item.entry, { kind: 'error', reason: why(vt, e) });
    }
  }
}

/** The status rules from the header, as one decision. */
export function decide(status, stats, promote) {
  const detections = (stats.malicious ?? 0) + (stats.suspicious ?? 0);
  if (detections > 0) return { status: status === 'clean' ? 'unverified' : status, review: true };
  if (promote && status === 'unverified') return { status: 'clean', review: false };
  return { status, review: false };
}

function apply(entry, result, { today, promote }) {
  const before = entry.app.security;
  const { status, review } = decide(before.status, result.stats, promote.has(entry.slug));
  const security = { status, evidence: `${GUI}${result.id}`, checkedAt: today };
  const text = patchSecurity(entry.text, security);
  const app = JSON.parse(text);
  if (rest(app) !== rest(entry.app) || JSON.stringify(app.security) !== JSON.stringify(security)) {
    throw new Error(`patch of ${entry.slug} did not apply cleanly`);
  }
  entry.text = text;
  entry.app = app;
  entry.dirty = true;
  return { was: before.status, status, review };
}

/**
 * Re-checks the catalogue in `appsDir`. Pure apart from the files it
 * rewrites and the `fetch` it is given, so tests drive it in-process.
 */
export async function recheck(options) {
  const {
    appsDir,
    apiKey,
    fetch = globalThis.fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
    today = new Date().toISOString().slice(0, 10),
    slugs = [],
    promote = [],
    onlyListed = false,
    maxAge = DEFAULTS.maxAge,
    budget = DEFAULTS.budget,
    intervalMs = DEFAULTS.intervalMs,
    carryDir,
    log = () => {},
  } = options;

  const entries = loadEntries(appsDir, log);
  const carried = carry(entries, carryDir);
  const promoted = new Set(promote);
  const queue = select(entries, {
    slugs: [...new Set([...slugs, ...promote])],
    onlyListed,
    maxAge,
    today,
  });
  const vt = client({
    apiKey,
    fetch,
    sleep,
    now,
    intervalMs,
    budget: Math.min(Math.max(budget, 0), 500),
  });

  const rows = [];
  const outcome = (entry, result) => {
    if (result.kind !== 'scanned') {
      rows.push({ slug: entry.slug, ...result });
      return;
    }
    const detections = {
      malicious: result.stats.malicious ?? 0,
      suspicious: result.stats.suspicious ?? 0,
    };
    const change = apply(entry, result, { today, promote: promoted });
    const mismatch = result.id !== urlId(entry.app.links.download);
    if (mismatch) log(`vt-recheck: ${entry.slug}: VirusTotal's URL id differs from the local hash`);
    rows.push({
      slug: entry.slug,
      kind: 'scanned',
      evidence: `${GUI}${result.id}`,
      ...detections,
      ...change,
      mismatch,
    });
  };

  const pending = await submitAll(vt, queue, outcome);
  await readAll(vt, pending, outcome);

  for (const entry of entries.filter((e) => e.dirty)) writeFileSync(entry.path, entry.text);
  return {
    rows,
    carried,
    changed: entries.filter((e) => e.dirty).length,
    review: rows.filter((r) => r.review),
    spent: vt.spent(),
    quotaHit: vt.state.quotaHit,
    selected: queue.length,
  };
}

function resultCell(r) {
  if (r.kind !== 'scanned') return `not checked (${r.reason})`;
  const found = r.malicious + r.suspicious > 0;
  const text = found ? `⚠ ${r.malicious} malicious, ${r.suspicious} suspicious` : 'no detections';
  return r.mismatch ? `${text} · id ≠ local hash` : text;
}

function statusCell(r) {
  if (!r.status) return '—';
  return r.was !== r.status ? `${r.was} → **${r.status}**` : r.status;
}

/** The PR body / job summary. */
export function summary(report, { today }) {
  const lines = [
    `VirusTotal re-check, ${today} (docs/12 §4b). Each row re-scanned the entry's`,
    '`links.download` page; only the three `security` lines change.',
    '',
    `- scanned: ${report.rows.filter((r) => r.kind === 'scanned').length} of ${report.selected} due · requests: ${report.spent}` +
      (report.quotaHit ? ' · **stopped at the daily quota** — the next run continues' : ''),
    `- needs review (detections): ${report.review.length}` +
      (report.review.length ? ` — ${report.review.map((r) => `\`${r.slug}\``).join(', ')}` : ''),
  ];
  if (report.carried.length) {
    lines.push(
      `- carried from the open re-check PR: ${report.carried.length} (${report.carried.join(', ')})`,
    );
  }
  lines.push('', '| entry | result | status | scan |', '|---|---|---|---|');
  for (const r of report.rows) {
    const scan = r.evidence ? `[scan](${r.evidence})` : '—';
    lines.push(`| \`${r.slug}\` | ${resultCell(r)} | ${statusCell(r)} | ${scan} |`);
  }
  lines.push(
    '',
    'A detection never flags or removes anything: `clean` becomes `unverified` and an',
    'issue asks the maintainer to decide (docs/09 §6; a confirmed one goes through',
    "`pnpm quarantine`). This reports what VirusTotal's engines said on the day —",
    'not a safety guarantee (hard rule 4).',
  );
  return lines.join('\n') + '\n';
}

function int(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function main(env = process.env, cwd = process.cwd()) {
  const out = (key, value) => {
    if (env['GITHUB_OUTPUT']) appendFileSync(env['GITHUB_OUTPUT'], `${key}=${value}\n`);
  };
  const today = new Date().toISOString().slice(0, 10);
  const apiKey = env['VT_API_KEY'];
  if (!apiKey) {
    console.log(
      'vt-recheck: VT_API_KEY is not set — nothing scanned (forks and Dependabot have no secrets)',
    );
    out('changed', 0);
    out('review', '');
    return 0;
  }
  try {
    const report = await recheck({
      appsDir: join(cwd, 'src/data/apps'),
      apiKey,
      today,
      slugs: parseSlugs(env['VT_SLUGS'], console.error),
      promote: parseSlugs(env['VT_PROMOTE'], console.error),
      onlyListed: env['VT_ONLY_LISTED'] === '1',
      maxAge: int(env['VT_MAX_AGE'], DEFAULTS.maxAge),
      budget: int(env['VT_BUDGET'], DEFAULTS.budget),
      intervalMs: int(env['VT_INTERVAL_MS'], DEFAULTS.intervalMs),
      carryDir: env['VT_CARRY'] || undefined,
      log: console.error,
    });
    const text = summary(report, { today });
    if (env['VT_SUMMARY']) writeFileSync(env['VT_SUMMARY'], text);
    if (env['VT_REVIEW_JSON'])
      writeFileSync(env['VT_REVIEW_JSON'], JSON.stringify(report.review, null, 2));
    console.log(text);
    if (report.quotaHit)
      console.log('::warning::VirusTotal quota reached — the next run continues');
    out('changed', report.changed);
    out('review', report.review.map((r) => r.slug).join(' '));
    return 0;
  } catch (e) {
    console.error(`vt-recheck: ${e.message}`);
    out('changed', 0);
    out('review', '');
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main();
