// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// WCAG AA for the design tokens, read straight from global.css — so a colour
// tweak that breaks legibility fails here, in both themes, before anyone
// has to notice it on a screen. OKLCH is converted the way browsers do
// (OKLab → linear sRGB, gamut-clipped) and compared with the WCAG 2.2
// relative-luminance formula.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(join(process.cwd(), 'src/styles/global.css'), 'utf8');

type Rgb = [number, number, number];

function oklchToLinearSrgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clip(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clip(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clip(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function ratio(fg: Rgb, bg: Rgb): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The `--sh-*: oklch(L C H)` declarations of the block opened by `selector`. */
function block(selector: string): Map<string, string> {
  const at = CSS.indexOf(`${selector} {`);
  expect(at, `token block ${selector}`).toBeGreaterThan(-1);
  const body = CSS.slice(at, CSS.indexOf('}', at));
  const tokens = new Map<string, string>();
  for (const m of body.matchAll(/--sh-([\w-]+):\s*([^;]+);/g)) {
    tokens.set(m[1]!, m[2]!.replace(/\s+/g, ' ').trim());
  }
  return tokens;
}

function color(tokens: Map<string, string>, name: string): Rgb {
  const raw = tokens.get(name);
  const m = raw && /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(raw);
  if (!m) throw new Error(`--sh-${name} is not a plain oklch(L C H): ${raw}`);
  return oklchToLinearSrgb(Number(m[1]), Number(m[2]), Number(m[3]));
}

const THEMES = {
  light: block(":root[data-theme='light']"),
  dark: block(":root[data-theme='dark']"),
};

/** [foreground, background, minimum] — text 4.5:1, control edges 3:1. */
const PAIRS: Array<[string, string, number]> = [
  ...['bg', 'surface', 'surface-2'].flatMap((bg): Array<[string, string, number]> => [
    ['ink', bg, 7],
    ['muted', bg, 4.5],
    ['accent', bg, 4.5],
    ['ok', bg, 4.5],
    ['warn', bg, 4.5],
    ['danger', bg, 4.5],
    // WCAG 1.4.11: an input's, select's or button's boundary.
    ['control', bg, 3],
  ]),
  ['accent-ink', 'accent', 4.5],
  ['ok', 'ok-soft', 4.5],
  ['accent', 'accent-soft', 4.5],
  ['warn', 'warn-soft', 4.5],
  ['ink', 'accent-soft', 4.5],
];

describe('design tokens meet WCAG AA (src/styles/global.css)', () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    it.each(PAIRS)(`${theme}: %s on %s ≥ %s:1`, (fg, bg, min) => {
      expect(ratio(color(tokens, fg), color(tokens, bg))).toBeGreaterThanOrEqual(min);
    });
  }

  it('gives scripting-off dark mode exactly the dark theme', () => {
    const media = block('  :root:not([data-theme])');
    expect([...media]).toEqual([...THEMES.dark]);
  });
});
