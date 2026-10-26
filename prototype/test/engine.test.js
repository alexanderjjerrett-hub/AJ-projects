import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as data from '../src/data.js';
import { route, shortestPaths, toMinutes } from '../src/routing.js';
import { search } from '../src/search.js';
import { parseQuery } from '../src/query.js';
import { nearestNode } from '../src/locate.js';

const graph = { nodes: data.nodes, edges: data.edges, pois: data.pois };
const at = toMinutes;
const beginner = { mode: 'ski', maxLevel: 1 };
const intermediate = { mode: 'ski', maxLevel: 2 };
const expert = { mode: 'ski', maxLevel: 4 };
const walker = { mode: 'walk', maxLevel: 0 };

const pistesOn = (r) => r.path.filter((s) => s.edge.type === 'piste');

test('no route ever uses a piste above the traveller’s level', () => {
  for (const profile of [beginner, intermediate, { mode: 'ski', maxLevel: 3 }]) {
    for (const origin of data.nodes) {
      for (const [, r] of shortestPaths(graph, origin.id, profile, at('09:30'))) {
        for (const s of pistesOn(r)) assert.ok(s.edge.level <= profile.maxLevel, `${s.edge.name} on ${origin.id}`);
      }
    }
  }
});

test('walkers only use footpaths, buses and pedestrian lifts', () => {
  for (const [, r] of shortestPaths(graph, 'morzine', walker, at('10:00'))) {
    for (const s of r.path) {
      assert.notEqual(s.edge.type, 'piste');
      if (s.edge.type === 'lift') assert.equal(s.edge.pedestrian, true, s.edge.name);
    }
  }
});

test('walker can reach Avoriaz via shuttle and cable car but not the Lindarets', () => {
  const reach = shortestPaths(graph, 'morzine', walker, at('10:00'));
  assert.ok(reach.has('avoriaz'));
  assert.ok(!reach.has('lindarets'));
});

test('beginner cannot get down to Morzine from Pleney on snow, so rides the gondola down', () => {
  const r = route(graph, 'pleney_top', 'morzine', beginner, at('11:00'));
  assert.ok(r);
  assert.deepEqual(r.path.map((s) => [s.edge.id, s.direction]), [['L_pleney', 'down']]);
});

test('expert takes the Swiss Wall to Les Crosets; intermediate rides the chair down', () => {
  const ex = route(graph, 'avoriaz', 'les_crosets', expert, at('10:00'));
  assert.ok(ex.path.some((s) => s.edge.id === 'P_swiss_wall'));
  const mid = route(graph, 'avoriaz', 'les_crosets', intermediate, at('10:00'));
  assert.ok(!mid.path.some((s) => s.edge.id === 'P_swiss_wall'));
  assert.ok(mid.path.some((s) => s.edge.id === 'L_chavanette' && s.direction === 'down'));
});

test('snowboarders avoid the drag lift when a chair is available', () => {
  const ski = route(graph, 'lindarets', 'avoriaz', intermediate, at('10:00'));
  const board = route(graph, 'lindarets', 'avoriaz', { mode: 'snowboard', maxLevel: 2 }, at('10:00'));
  assert.equal(ski.path[0].edge.id, 'L_lindarets_drag');
  assert.equal(board.path[0].edge.id, 'L_lindarets_chair');
});

test('closed lifts are not used: after last lift, Les Crosets is unreachable', () => {
  assert.ok(route(graph, 'avoriaz', 'les_crosets', expert, at('15:00')));
  assert.equal(route(graph, 'avoriaz', 'les_crosets', expert, at('16:30')), null);
});

test('waiting for a lift to open is allowed', () => {
  const r = route(graph, 'morzine', 'pleney_top', beginner, at('08:00'));
  assert.equal(r.path[0].depart, at('08:00'));
  assert.equal(r.arrival, at('08:45') + 3 + 8);
});

test('search: nearest toilet for a beginner in Morzine is in the village', () => {
  const [first] = search(graph, { origin: 'morzine', profile: beginner, category: 'toilet', depart: at('10:00') });
  assert.equal(first.poi.id, 'mz_wc');
  assert.equal(first.minutes, 0);
});

test('search: walker lunch from Morzine never offers piste-only restaurants', () => {
  const results = search(graph, { origin: 'morzine', profile: walker, category: 'restaurant', depart: at('11:45'), limit: 20 });
  const ids = results.map((r) => r.poi.id);
  assert.ok(ids.includes('pl_self'));
  assert.ok(!ids.includes('li_goat'));
  assert.ok(!ids.includes('ch_terrace'));
});

test('search: warns when a late lunch would miss the last lift back', () => {
  const results = search(graph, { origin: 'avoriaz', profile: intermediate, category: 'restaurant', depart: at('15:10'), limit: 20 });
  const goat = results.find((r) => r.poi.id === 'li_goat');
  assert.ok(goat, 'Lindarets restaurant should still be open on arrival');
  assert.ok(goat.warnings.some((w) => w.startsWith('No lift or bus back to Avoriaz')));
  const early = search(graph, { origin: 'avoriaz', profile: intermediate, category: 'restaurant', depart: at('12:00'), limit: 20 });
  assert.deepEqual(early.find((r) => r.poi.id === 'li_goat').warnings, []);
});

test('search: bars open past midnight count as open in the evening', () => {
  const [first] = search(graph, { origin: 'avoriaz', profile: expert, category: 'bar', depart: at('18:00') });
  assert.equal(first.poi.id, 'av_bar');
});

test('parseQuery understands occasions, ability, mode, place and preferences', () => {
  assert.deepEqual(parseQuery('Cheap lunch near Les Gets, beginner with kids', data.nodes), {
    category: 'restaurant', maxLevel: 1, place: 'les_gets', tags: ['kids', 'budget'],
  });
  assert.equal(parseQuery('need a loo at Super Morzine', data.nodes).place, 'super_morzine');
  assert.equal(parseQuery('need a loo at Super Morzine', data.nodes).category, 'toilet');
  const apres = parseQuery('après drinks in Avoriaz, I’m not skiing', data.nodes);
  assert.equal(apres.category, 'bar');
  assert.equal(apres.mode, 'walk');
  assert.equal(apres.place, 'avoriaz');
  assert.equal(parseQuery('my binding broke, snowboarder on reds', data.nodes).subtype, 'rental');
  assert.equal(parseQuery('my binding broke, snowboarder on reds', data.nodes).mode, 'snowboard');
  assert.equal(parseQuery('my binding broke, snowboarder on reds', data.nodes).maxLevel, 3);
});

test('GPS position snaps to the nearest station, or null when far away', () => {
  assert.equal(nearestNode(data.nodes, { lat: 46.1915, lon: 6.7745 }).node.id, 'avoriaz');
  assert.equal(nearestNode(data.nodes, { lat: 51.5, lon: -0.12 }), null);
});
