// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Build guard: every page's markup must be allowed by that page's own CSP
 * (docs/09 §4). Formerly check-no-inline-styles.mjs.
 *
 * WHY THIS EXISTS. The CSP is a per-page <meta> that Astro generates with
 * hashes for the inline code it knows about. Anything it does NOT know about
 * is refused by the browser SILENTLY — the build passes, the source looks
 * right, and the page renders without it:
 *
 *   - an inline `style="…"` attribute (hashes never apply to attributes, and
 *     the policy has neither 'unsafe-inline' nor 'unsafe-hashes'): that is how
 *     the sticky header shipped transparent (2026-07-28);
 *   - a <style> element Astro did not hash: `transition:name` once shipped
 *     1.5 MB of CSS refused on every page with all gates green;
 *   - an inline <script> body Astro did not hash (Astro only hashes scripts it
 *     bundles itself, so a hand-written `is:inline` body would be refused).
 *
 * It also fails when a page has NO CSP meta (formerly a silent skip that still
 * printed OK), and when anything executable precedes the meta tag — a meta
 * policy only governs what comes after it (see scripts/postbuild.mjs).
 *
 * Fix for a style failure: use a Tailwind utility. Every design token is
 * exposed as one (`text-sh-muted`, `bg-sh-surface`, …) in
 * src/styles/global.css.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = join(process.cwd(), 'dist');

const CSP_META = /<meta http-equiv="content-security-policy" content="([^"]+)"/i;
/**
 * <style> and <script> elements; external scripts (with `src`) are skipped in
 * the code below. The end tags accept what the HTML tokenizer accepts —
 * `</script >`, `</script foo>` — so an oddly written end tag cannot hide an
 * element's content from the hash check (CodeQL js/bad-tag-filter). This
 * reads our own build output, but a checker must not have blind spots.
 */
const STYLE_EL = /<style\b[^>]*>([\s\S]*?)<\/style\b[^>]*>/gi;
const SCRIPT_EL = /<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi;
const HAS_SRC = /\ssrc\s*=/i;
const DATA_BLOCK = /\stype="application\/(?:ld\+)?json"/i;
/** Every start tag. `[^>]*` is a single linear run — no nested quantifiers. */
const START_TAG = /<[a-z][^>]*>/gi;
/**
 * A `style` attribute in any of HTML's three value syntaxes — double-quoted,
 * single-quoted or unquoted — and any letter case. Applied to one bounded tag
 * string at a time, which keeps it linear (SonarCloud S8786).
 */
const STYLE_ATTR = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const sha256 = (s) => `sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}`;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

const problems = {
  styleAttr: [],
  unhashedStyle: [],
  unhashedScript: [],
  missingCsp: [],
  lateCsp: [],
};
let pages = 0;
const styleHashes = new Set();

for (const file of walk(DIST)) {
  pages++;
  const html = readFileSync(file, 'utf8');
  const rel = relative(process.cwd(), file);

  for (const [tag] of html.matchAll(START_TAG)) {
    const m = STYLE_ATTR.exec(tag);
    if (!m) continue;
    const decl = m[1] ?? m[2] ?? m[3] ?? '';
    // An empty style="" is harmless noise from a framework; a declaration is not.
    if (decl.trim() !== '')
      problems.styleAttr.push({ rel, detail: `style="${decl.slice(0, 70)}"` });
  }

  const cspMatch = CSP_META.exec(html);
  if (!cspMatch) {
    problems.missingCsp.push({ rel, detail: 'no <meta http-equiv="content-security-policy">' });
    continue;
  }
  const csp = cspMatch[1];
  const firstScript = html.search(/<script[\s>]/i);
  if (firstScript !== -1 && firstScript < cspMatch.index) {
    problems.lateCsp.push({ rel, detail: 'a <script> precedes the CSP meta tag' });
  }

  for (const m of html.matchAll(STYLE_EL)) {
    const hash = sha256(m[1]);
    styleHashes.add(hash);
    if (!csp.includes(`'${hash}'`)) {
      problems.unhashedStyle.push({ rel, detail: `${hash} ${JSON.stringify(m[1].slice(0, 60))}` });
    }
  }

  for (const m of html.matchAll(SCRIPT_EL)) {
    if (HAS_SRC.test(m[1])) continue; // external: covered by script-src, not a hash
    if (DATA_BLOCK.test(m[1])) continue; // JSON-LD is data, not script
    const hash = sha256(m[2]);
    if (!csp.includes(`'${hash}'`)) {
      problems.unhashedScript.push({ rel, detail: `${hash} ${JSON.stringify(m[2].slice(0, 60))}` });
    }
  }
}

const advice = {
  styleAttr:
    'CSP style-src drops these silently. Use a Tailwind utility — the design tokens are\n  exposed as one in src/styles/global.css.',
  unhashedStyle:
    'Astro hashes the styles it knows about; anything it misses must be removed or added\n  via security.csp.styleDirective.hashes (docs/09 §4).',
  unhashedScript:
    'Astro only hashes scripts it bundles. Move the code into a file and reference it with\n  `?url&no-inline` (see Base.astro), or add its hash to security.csp.scriptDirective.',
  missingCsp:
    "Astro's security.csp emits the policy per page; a page without it is unprotected and\n  invisible to every other check here.",
  lateCsp:
    'A meta CSP only governs what follows it. scripts/postbuild.mjs moves it to the top of\n  <head> — did it run?',
};

let failed = false;
for (const [kind, list] of Object.entries(problems)) {
  if (list.length === 0) continue;
  failed = true;
  console.error(`check-csp — ${list.length} problem(s): ${kind}`);
  const seen = new Set();
  for (const { rel, detail } of list) {
    if (seen.has(detail)) continue;
    seen.add(detail);
    if (seen.size > 10) break;
    console.error(`  ✗ ${rel}\n      ${detail}`);
  }
  console.error(`  ${advice[kind]}\n`);
}

if (pages === 0) {
  console.error('check-csp — found no HTML pages under dist/. Run `astro build` first.');
  failed = true;
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    `check-csp — OK (${pages} pages: policy first in <head>, no style attributes, ` +
      `${styleHashes.size} <style> hash(es) and every inline script allowed by its own page)`,
  );
}
