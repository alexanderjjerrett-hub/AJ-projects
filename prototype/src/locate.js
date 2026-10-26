// GPS → graph snapping. Phase 1 snaps to the nearest node; production will
// snap to the nearest piste/lift segment as well (docs/DESIGN.md §4.2).

const EARTH_RADIUS_M = 6371000;
const MAX_SNAP_M = 3000; // further than this and we're probably outside the mapped area

export function distanceMetres(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function nearestNode(nodes, position) {
  let best = null;
  for (const n of nodes) {
    const d = distanceMetres(position, n);
    if (!best || d < best.distance) best = { node: n, distance: d };
  }
  if (!best || best.distance > MAX_SNAP_M) return null;
  return best;
}
