// Serves elevation tiles to the map from a bundled terrain pack (a folder of
// z/x/y.png tiles plus index.json, built by scripts/build-terrain-pack.mjs)
// instead of a tile server.

// Nearest packed ancestor of a tile, with the tile's position inside it.
export function findAncestor(available, z, x, y) {
  for (let dz = 1; dz <= z; dz++) {
    const key = `${z - dz}/${x >> dz}/${y >> dz}`;
    if (available.has(key)) return { key, dz, subX: x - ((x >> dz) << dz), subY: y - ((y >> dz) << dz) };
  }
  return null;
}

// Registers a `pack://dem/{z}/{x}/{y}` protocol with MapLibre, reading from `baseUrl`.
export function registerTerrainPack(maplibregl, baseUrl) {
  const ready = fetch(`${baseUrl}index.json`).then(async (res) => {
    if (!res.ok) throw new Error(`Terrain pack index: ${res.status}`);
    return new Set((await res.json()).tiles);
  });
  const tile = async (key) => {
    const res = await fetch(`${baseUrl}${key}.png`);
    if (!res.ok) throw new Error(`Terrain tile ${key}: ${res.status}`);
    return res.arrayBuffer();
  };

  maplibregl.addProtocol('pack', async (params) => {
    const [, z, x, y] = params.url.match(/(\d+)\/(\d+)\/(\d+)$/).map(Number);
    const available = await ready;
    const key = `${z}/${x}/${y}`;
    if (available.has(key)) return { data: await tile(key) };

    // Outside the detailed area: enlarge part of a lower-zoom tile. Nearest-neighbour
    // scaling, because blending Terrarium's packed RGB values would corrupt the heights.
    const up = findAncestor(available, z, x, y);
    if (!up) throw new Error(`No terrain for ${key}`);
    const image = await createImageBitmap(new Blob([await tile(up.key)], { type: 'image/png' }));
    const size = 256 >> up.dz;
    const canvas = new OffscreenCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, up.subX * size, up.subY * size, size, size, 0, 0, 256, 256);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { data: await blob.arrayBuffer() };
  });
  return ready;
}
