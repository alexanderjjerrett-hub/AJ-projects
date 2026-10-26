// Downloads AWS Terrain Tiles (Terrarium PNGs) for the Portes du Soleil into a
// "terrain pack": a folder of z/x/y.png tiles plus index.json listing them, so
// the 3D map works with no tile server (offline packs, docs/DESIGN.md §4.2).
//
// Usage: NODE_USE_ENV_PROXY=1 node scripts/build-terrain-pack.mjs <out-dir>

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

// Wider coverage at low zoom fills the distant horizon of a tilted view;
// detail is only needed over the ski area itself.
export const BANDS = [
  { zooms: [6, 7, 8, 9], bbox: [5.5, 45.4, 8.0, 47.0] },
  { zooms: [10, 11], bbox: [6.2, 45.85, 7.3, 46.5] },
  { zooms: [12], bbox: [6.45, 46.0, 7.05, 46.36] },
  { zooms: [13], bbox: [6.58, 46.1, 6.92, 46.26] },
];

function tileRange(z, [w, s, e, n]) {
  const n2 = 2 ** z;
  const x = (lon) => Math.floor(((lon + 180) / 360) * n2);
  const y = (lat) => Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n2);
  return { x0: x(w), x1: x(e), y0: y(n), y1: y(s) };
}

async function fetchTile(z, x, y) {
  const url = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

const outDir = process.argv[2] ?? 'dist/artifact/terrain';
const jobs = [];
for (const band of BANDS) {
  for (const z of band.zooms) {
    const { x0, x1, y0, y1 } = tileRange(z, band.bbox);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push({ z, x, y });
  }
}
let bytes = 0;
for (let i = 0; i < jobs.length; i += 8) {
  await Promise.all(jobs.slice(i, i + 8).map(async ({ z, x, y }) => {
    const data = await fetchTile(z, x, y);
    await mkdir(path.join(outDir, String(z), String(x)), { recursive: true });
    await writeFile(path.join(outDir, String(z), String(x), `${y}.png`), data);
    bytes += data.length;
  }));
}
await writeFile(path.join(outDir, 'index.json'), JSON.stringify({ tiles: jobs.map(({ z, x, y }) => `${z}/${x}/${y}`) }));
console.log(`${jobs.length} tiles, ${(bytes / 1e6).toFixed(1)} MB in ${outDir}`);
