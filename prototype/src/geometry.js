// Turns the routing graph into GeoJSON for the map.
// Lifts are drawn straight (as they are in reality). Pistes and bus routes
// are drawn as gentle curves so parallel links between the same two places
// don't sit on top of each other. Real piste geometry from OpenStreetMap
// replaces these curves in production (docs/DESIGN.md §7).

const M_PER_DEG_LAT = 110540;
const mPerDegLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

const CURVE_POINTS = 24;
const BEND = { piste: 0.14, bus: -0.1 }; // fraction of the link length

// Index of each edge among the edges joining the same two nodes, used to fan them out.
function siblingIndex(edges) {
  const seen = new Map();
  const index = new Map();
  for (const e of edges) {
    if (e.type === 'lift') continue;
    const key = [e.from, e.to].sort().join('|');
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    index.set(e.id, k);
  }
  return index;
}

export function edgeCoordinates(edge, nodeById, k = 0) {
  const a = nodeById.get(edge.from);
  const b = nodeById.get(edge.to);
  if (edge.type === 'lift') return [[a.lon, a.lat], [b.lon, b.lat]];

  // Work in metres so the bend looks the same whatever the direction.
  const kx = mPerDegLon(a.lat);
  const ax = a.lon * kx, ay = a.lat * M_PER_DEG_LAT;
  const bx = b.lon * kx, by = b.lat * M_PER_DEG_LAT;
  const len = Math.hypot(bx - ax, by - ay);
  // Bend relative to a fixed orientation, so A→B and B→A edges fan out consistently.
  const flip = edge.from < edge.to ? 1 : -1;
  const bend = (BEND[edge.type] ?? 0.1) * len * (1 + k * 0.8) * (k % 2 ? -1 : 1) * flip;
  const nx = -(by - ay) / len, ny = (bx - ax) / len;
  const cx = (ax + bx) / 2 + nx * bend, cy = (ay + by) / 2 + ny * bend;

  const coords = [];
  for (let i = 0; i <= CURVE_POINTS; i++) {
    const t = i / CURVE_POINTS;
    const x = (1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t ** 2 * bx;
    const y = (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t ** 2 * by;
    coords.push([x / kx, y / M_PER_DEG_LAT]);
  }
  return coords;
}

export function networkGeoJSON(graph) {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const index = siblingIndex(graph.edges);
  const lines = new Map();
  const features = graph.edges.map((e) => {
    const coordinates = edgeCoordinates(e, nodeById, index.get(e.id) ?? 0);
    lines.set(e.id, coordinates);
    return {
      type: 'Feature',
      properties: { id: e.id, name: e.name, type: e.type, level: e.level ?? 0, liftType: e.liftType ?? '' },
      geometry: { type: 'LineString', coordinates },
    };
  });
  return { geojson: { type: 'FeatureCollection', features }, lines };
}

// GeoJSON for a route (as returned by routing.shortestPaths), following each edge's drawn line.
export function routeGeoJSON(path, lines) {
  return {
    type: 'FeatureCollection',
    features: path.map((step) => {
      const coords = lines.get(step.edge.id) ?? [];
      const forwards = step.from === step.edge.from;
      return {
        type: 'Feature',
        properties: { type: step.edge.type, level: step.edge.level ?? 0 },
        geometry: { type: 'LineString', coordinates: forwards ? coords : [...coords].reverse() },
      };
    }),
  };
}

export function bounds(coordinates) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of coordinates) {
    w = Math.min(w, lon); e = Math.max(e, lon);
    s = Math.min(s, lat); n = Math.max(n, lat);
  }
  return [[w, s], [e, n]];
}
