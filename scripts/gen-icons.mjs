// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
/**
 * Generates the raster icons from one vector mark: `pnpm icons`.
 *
 * The mark is the anchor SoftHarbor has always used ("a safe berth after a
 * reinstall", docs/00 D1), now on a fixed harbour-blue tile. The previous
 * favicon drew the anchor in `currentColor`, which renders BLACK in a browser
 * tab or launcher (there is no CSS context there) — invisible on dark tab
 * strips — and it was also the only, unsafe, "maskable" PWA icon.
 *
 * Output is committed (public/), so builds never depend on this script or on
 * sharp's native binary; re-run it only when the mark changes.
 *
 *   public/favicon.svg             tab icon (vector, rounded tile)
 *   public/favicon.ico             16/32/48 px, for clients that ask for /favicon.ico
 *   public/apple-touch-icon.png    180 px, full-bleed (iOS applies its own mask)
 *   public/icons/icon-192.png      PWA "any"
 *   public/icons/icon-512.png      PWA "any"
 *   public/icons/maskable-512.png  PWA "maskable": full-bleed, mark inside the 80 % safe zone
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT = join(process.cwd(), 'public');
const DEEP = '#0B4F7A';
const LIGHT = '#1C93B8';

/** The anchor, drawn on a 32-unit grid centred at (16, 16). */
const ANCHOR = `
  <circle cx="16" cy="8.5" r="2.6" />
  <path d="M16 11.1v13.4" />
  <path d="M10.5 15h11" />
  <path d="M7.5 18.5a8.5 8.5 0 0 0 17 0" />`;

/**
 * @param {{ rounded: boolean, scale: number }} opts
 *   rounded — rounded tile on transparency (tab/"any") vs full-bleed square;
 *   scale   — anchor size relative to the tile (maskable keeps it in the safe zone).
 */
function mark({ rounded, scale }) {
  const offset = 16 - 16 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="sh-tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${LIGHT}" />
      <stop offset="1" stop-color="${DEEP}" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" ${rounded ? 'rx="7"' : ''} fill="url(#sh-tile)" />
  <g fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
     transform="translate(${offset} ${offset}) scale(${scale})">${ANCHOR}
  </g>
</svg>
`;
}

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 72 * (size / 32) * 2 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

/** Minimal ICO container: a directory of PNG-encoded images (Vista+). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const tile = mark({ rounded: true, scale: 1 });
const bleed = mark({ rounded: false, scale: 1 });
const maskable = mark({ rounded: false, scale: 0.72 });

mkdirSync(join(OUT, 'icons'), { recursive: true });
writeFileSync(join(OUT, 'favicon.svg'), tile);
writeFileSync(join(OUT, 'icons/icon-192.png'), await png(tile, 192));
writeFileSync(join(OUT, 'icons/icon-512.png'), await png(tile, 512));
writeFileSync(join(OUT, 'icons/maskable-512.png'), await png(maskable, 512));
writeFileSync(join(OUT, 'apple-touch-icon.png'), await png(bleed, 180));
writeFileSync(
  join(OUT, 'favicon.ico'),
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(tile, size) })))),
);

console.log(
  'icons — wrote favicon.svg, favicon.ico, apple-touch-icon.png, icons/{icon-192,icon-512,maskable-512}.png',
);
