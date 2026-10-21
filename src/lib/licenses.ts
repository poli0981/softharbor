// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// docs/14 §3e — the package list on /legal/third-party, generated at BUILD
// time from package.json and the installed packages, so it cannot fall
// behind the code. (v1.0 promised "a full machine-generated dependency list"
// and shipped none; this is that list.)
//
// Build-time only: it reads the filesystem, so only .astro frontmatter may
// import it, never an island.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PackageLicense {
  name: string;
  /** The version actually installed, not the range in package.json. */
  version: string;
  /** SPDX expression as the package declares it; UNKNOWN when it declares none. */
  license: string;
}

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

/** Plain UTF-16 order — identical to the default sort, but explicit (S2871). */
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function licenseOf(meta: Record<string, unknown>): string {
  const field = meta['license'];
  if (typeof field === 'string' && field.trim() !== '') return field;
  // The pre-SPDX `{ "type": "MIT", "url": … }` shape some old packages use.
  if (field && typeof field === 'object' && typeof (field as { type?: unknown }).type === 'string')
    return (field as { type: string }).type;
  return 'UNKNOWN';
}

/** Every production dependency (package.json `dependencies`), sorted by name. */
export function productionLicenses(root: string = process.cwd()): PackageLicense[] {
  const pkg = readJson(join(root, 'package.json'));
  const declared = pkg['dependencies'];
  const deps = (declared && typeof declared === 'object' ? Object.keys(declared) : []).sort(
    byCodeUnit,
  );
  return deps.map((name) => {
    const meta = readJson(join(root, 'node_modules', name, 'package.json'));
    return { name, version: String(meta['version'] ?? '?'), license: licenseOf(meta) };
  });
}
