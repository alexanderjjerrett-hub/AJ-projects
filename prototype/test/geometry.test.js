import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as data from '../src/data.js';
import { networkGeoJSON, routeGeoJSON, bounds } from '../src/geometry.js';
import { route, toMinutes } from '../src/routing.js';

const graph = { nodes: data.nodes, edges: data.edges, pois: data.pois };
const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
const close = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

test('every edge is drawn as a line from its start node to its end node', () => {
  const { geojson } = networkGeoJSON(graph);
  assert.equal(geojson.features.length, data.edges.length);
  for (const f of geojson.features) {
    const e = data.edges.find((x) => x.id === f.properties.id);
    const c = f.geometry.coordinates;
    assert.ok(close(c[0], [nodeById.get(e.from).lon, nodeById.get(e.from).lat]), e.id);
    assert.ok(close(c.at(-1), [nodeById.get(e.to).lon, nodeById.get(e.to).lat]), e.id);
    if (e.type === 'lift') assert.equal(c.length, 2, 'lifts are straight');
  }
});

test('parallel pistes between the same places are drawn apart', () => {
  const { lines } = networkGeoJSON(graph);
  const blue = lines.get('P_pleney_home_blue');
  const red = lines.get('P_pleney_home_red');
  const mid = Math.floor(blue.length / 2);
  assert.ok(!close(blue[mid], red[mid]));
});

test('route lines follow the direction of travel, including lifts ridden down', () => {
  const { lines } = networkGeoJSON(graph);
  const r = route(graph, 'pleney_top', 'morzine', { mode: 'ski', maxLevel: 1 }, toMinutes('11:00'));
  const [leg] = routeGeoJSON(r.path, lines).features;
  const top = nodeById.get('pleney_top');
  assert.ok(close(leg.geometry.coordinates[0], [top.lon, top.lat]));
});

test('bounds wraps all coordinates', () => {
  assert.deepEqual(bounds([[6.7, 46.2], [6.6, 46.1], [6.8, 46.15]]), [[6.6, 46.1], [6.8, 46.2]]);
});
