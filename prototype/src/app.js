/* global maplibregl */
import * as data from './data.js';
import { toMinutes, toClock } from './routing.js';
import { search } from './search.js';
import { parseQuery } from './query.js';
import { nearestNode } from './locate.js';
import { networkGeoJSON, routeGeoJSON, bounds } from './geometry.js';

const graph = { nodes: data.nodes, edges: data.edges, pois: data.pois };
const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
const $ = (sel) => document.querySelector(sel);

const CATEGORY_LABEL = { restaurant: 'places to eat', bar: 'bars', toilet: 'toilets', shop: 'shops', atm: 'cash machines', firstaid: 'first aid' };
const SUBTYPE_LABEL = { rental: 'hire & repair shops', pharmacy: 'pharmacies', supermarket: 'food shops' };
const ICON = { restaurant: '🍽️', bar: '🍺', toilet: '🚻', shop: '🛍️', rental: '🔧', pharmacy: '💊', supermarket: '🛒', atm: '💶', firstaid: '🩹' };
const MODE_ICON = { ski: '⛷️', snowboard: '🏂', walk: '🥾' };
const LEVEL_COLOUR = ['#888888', '#1e9e4a', '#1f6fe0', '#d22f2f', '#111111'];

const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const HOME_VIEW = { center: [6.738, 46.168], zoom: 11.7, pitch: 62, bearing: 20 };
const ROUTE_PITCH = 58;

let lastSearch = null;
let lastResults = [];
let selected = 0;
let is3D = true;
const pins = [];
const placeMarkers = new Map();
let meMarker = null;

// ---------------------------------------------------------------- map setup

const network = networkGeoJSON(graph);
const demSource = {
  type: 'raster-dem',
  tiles: [TERRAIN_TILES],
  tileSize: 256,
  encoding: 'terrarium',
  maxzoom: 14,
  attribution: 'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>',
};
const levelColour = ['to-color', ['at', ['get', 'level'], ['literal', LEVEL_COLOUR]]];

const style = {
  version: 8,
  sources: {
    dem: demSource,
    shade: demSource,
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    topo: {
      type: 'raster',
      tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
      tileSize: 256,
      maxzoom: 17,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM · © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    },
    pistes: {
      type: 'raster',
      tiles: ['https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Pistes © <a href="https://www.opensnowmap.org">OpenSnowMap</a>',
    },
    network: { type: 'geojson', data: network.geojson },
    route: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#eef2f6' } },
    {
      id: 'relief',
      type: 'color-relief',
      source: 'shade',
      paint: {
        'color-relief-color': ['interpolate', ['linear'], ['elevation'],
          500, '#8fb07a', 1100, '#b9c9a2', 1400, '#dfe6e3', 1800, '#f4f7fa', 2400, '#ffffff'],
      },
    },
    { id: 'hillshade', type: 'hillshade', source: 'shade', paint: { 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': '#26364a' } },
    { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'visible' } },
    { id: 'topo', type: 'raster', source: 'topo', layout: { visibility: 'none' } },
    { id: 'pistes', type: 'raster', source: 'pistes', layout: { visibility: 'none' } },
    netLayer('net-bus', 'bus', { 'line-color': '#a24fd0', 'line-width': 2.5, 'line-dasharray': [2, 2] }),
    netLayer('net-piste-casing', 'piste', { 'line-color': '#ffffff', 'line-width': 6 }),
    netLayer('net-piste', 'piste', { 'line-color': levelColour, 'line-width': 3.5 }),
    netLayer('net-lift-casing', 'lift', { 'line-color': '#ffffff', 'line-width': 4.5 }),
    netLayer('net-lift', 'lift', { 'line-color': '#3b3f46', 'line-width': 2.5, 'line-dasharray': [1, 1.2] }),
    { id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 12, 'line-opacity': 0.95 } },
    {
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': 7,
        'line-color': ['match', ['get', 'type'], 'lift', '#3b3f46', 'bus', '#a24fd0', 'walk', '#f08c00', levelColour],
      },
    },
  ],
  terrain: { source: 'dem', exaggeration: 1.25 },
  sky: {
    'sky-color': '#7fb4e6',
    'horizon-color': '#dcebf7',
    'fog-color': '#eef4fa',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.85,
  },
};

function netLayer(id, type, paint) {
  return { id, type: 'line', source: 'network', filter: ['==', ['get', 'type'], type], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint };
}
const NET_LAYERS = ['net-bus', 'net-piste-casing', 'net-piste', 'net-lift-casing', 'net-lift'];

let map = null;
try {
  map = new maplibregl.Map({ container: 'map', style, ...HOME_VIEW, maxPitch: 80, attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map.on('load', () => {
    addPlaceMarkers();
    showWholeArea(0);
    syncLabelDensity();
    map.on('zoomend', syncLabelDensity);
    document.body.dataset.mapReady = 'true';
  });
  watchBasemapFailures();
} catch (err) {
  map = null;
  console.error(err);
  toast('Your browser can’t show the 3D map (WebGL is unavailable). Search still works.');
}

// Satellite/topo tiles need a connection. If they fail, fall back to the
// terrain-only background (which only needs the elevation tiles).
function watchBasemapFailures() {
  const failures = { satellite: 0, topo: 0 };
  const loaded = { satellite: false, topo: false };
  map.on('sourcedata', (e) => { if (e.sourceId in loaded && e.tile) loaded[e.sourceId] = true; });
  map.on('error', (e) => {
    const id = e.sourceId;
    if (!(id in failures) || loaded[id]) return;
    failures[id] += 1;
    if (failures[id] === 6 && document.querySelector(`input[name=base][value=${id}]`).checked) {
      document.querySelector('input[name=base][value=terrain]').checked = true;
      setBasemap('terrain');
      toast(`${id === 'satellite' ? 'Satellite imagery' : 'Topographic map'} isn’t available right now, so showing terrain only.`);
    }
  });
}

// Frame every mapped place. The area runs west–east, so on a portrait phone
// look along it (eastwards) rather than across it.
function showWholeArea(duration = 1200) {
  const portrait = window.innerHeight > window.innerWidth;
  const bearing = is3D && portrait ? 65 : 0;
  const camera = map.cameraForBounds(bounds(data.nodes.map((n) => [n.lon, n.lat])), { padding: mapPadding(), bearing });
  // cameraForBounds frames a flat map; tilted, the near half takes most of the
  // screen, so we can come in closer.
  map.easeTo({ ...camera, zoom: camera.zoom + (is3D ? 0.6 : 0), pitch: is3D ? HOME_VIEW.pitch : 0, bearing, duration });
}

// Lift-station labels crowd the overview, so only villages are labelled when zoomed out.
const STATION_LABEL_ZOOM = 12.3;
function syncLabelDensity() {
  document.body.classList.toggle('zoomed-out', map.getZoom() < STATION_LABEL_ZOOM);
}

function setBasemap(which) {
  if (!map) return;
  map.setLayoutProperty('satellite', 'visibility', which === 'satellite' ? 'visible' : 'none');
  map.setLayoutProperty('topo', 'visibility', which === 'topo' ? 'visible' : 'none');
}

function addPlaceMarkers() {
  for (const n of data.nodes) {
    const elem = el('div', { class: `place ${n.kind}`, title: `${n.name}, ${n.alt} m` }, n.name.replace(/\s*\(.*\)/, ''));
    elem.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const popup = new maplibregl.Popup({ offset: 14, closeButton: false })
        .setLngLat([n.lon, n.lat])
        .setDOMContent(el('div', {},
          el('strong', {}, n.name), el('br'),
          el('span', { class: 'hint' }, `${n.alt} m · ${n.country === 'CH' ? 'Switzerland' : 'France'}`), el('br'),
          button('Start from here', () => { popup.remove(); setOrigin(n.id); })))
        .addTo(map);
    });
    new maplibregl.Marker({ element: elem, anchor: 'left', offset: [-5, 0] }).setLngLat([n.lon, n.lat]).addTo(map);
    placeMarkers.set(n.id, elem);
  }
  highlightOrigin();
}

function highlightOrigin() {
  for (const [id, elem] of placeMarkers) elem.classList.toggle('origin', id === $('#origin').value);
}

// ---------------------------------------------------------------- controls

for (const n of data.nodes) $('#origin').add(new Option(n.name, n.id));

const now = new Date();
const nowMinutes = now.getHours() * 60 + now.getMinutes();
if (nowMinutes >= toMinutes('08:00') && nowMinutes <= toMinutes('20:00')) $('#time').value = toClock(nowMinutes);

function profile() {
  const mode = document.querySelector('input[name=mode]:checked').value;
  return { mode, maxLevel: mode === 'walk' ? 0 : Number($('#level').value) };
}

function syncProfile() {
  const p = profile();
  $('#ability-row').hidden = p.mode === 'walk';
  const ability = p.mode === 'walk' ? 'on foot' : `up to ${data.LEVEL_NAMES[p.maxLevel]} runs`;
  $('#profile-toggle').textContent = `${MODE_ICON[p.mode]} ${ability} · from ${$('#origin').selectedOptions[0].text} · ${$('#time').value}`;
  highlightOrigin();
}

function setOrigin(id) {
  $('#origin').value = id;
  syncProfile();
  rerun();
}

$('#profile-toggle').addEventListener('click', () => {
  const open = $('#profile').hidden;
  $('#profile').hidden = !open;
  $('#profile-toggle').setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { syncProfile(); rerun(); }));
['#level', '#origin', '#time'].forEach((s) => $(s).addEventListener('change', () => { syncProfile(); rerun(); }));

document.querySelectorAll('.quick button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.quick button').forEach((x) => x.classList.toggle('active', x === b));
  const criteria = {
    category: b.dataset.category,
    subtype: b.dataset.subtype || undefined,
    tags: b.dataset.tags ? b.dataset.tags.split(',') : [],
  };
  run(criteria, describeCriteria(criteria));
}));

$('#ask').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const text = $('#q').value.trim();
  if (!text) return;
  $('#q').blur();
  document.querySelectorAll('.quick button').forEach((x) => x.classList.remove('active'));
  const parsed = parseQuery(text, data.nodes);

  // The query can override the profile and start point.
  if (parsed.mode) document.querySelector(`input[name=mode][value=${parsed.mode}]`).checked = true;
  if (parsed.maxLevel) $('#level').value = String(parsed.maxLevel);
  if (parsed.place) $('#origin').value = parsed.place;
  syncProfile();

  if (!parsed.category) {
    lastSearch = null;
    lastResults = [];
    showSheet();
    $('#understood').textContent = 'Sorry, I didn’t catch what you’re looking for. Try “lunch”, “toilets”, “après” or “hire shop”, or tap a button.';
    $('#results').replaceChildren();
    clearPins();
    return;
  }
  const criteria = { category: parsed.category, subtype: parsed.subtype, tags: parsed.tags };
  run(criteria, describeCriteria(criteria));
});

function describeCriteria({ category, subtype, tags = [] }) {
  const what = SUBTYPE_LABEL[subtype] ?? CATEGORY_LABEL[category];
  const prefs = tags.filter((t) => t !== 'apres');
  return `Nearest ${what}${prefs.length ? `, preferring ${prefs.join(', ')}` : ''}`;
}

$('#gps').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Location isn’t available on this device. Tap a place on the map instead.');
  toast('Finding you…');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const pos = { lat: coords.latitude, lon: coords.longitude };
      const hit = nearestNode(data.nodes, pos);
      if (!hit) return toast('You seem to be outside the mapped area (Morzine, Les Gets, Avoriaz). Tap a place on the map to start from there.');
      if (map) {
        meMarker?.remove();
        meMarker = new maplibregl.Marker({ element: el('div', { class: 'me', title: 'You are here' }) }).setLngLat([pos.lon, pos.lat]).addTo(map);
        map.flyTo({ center: [pos.lon, pos.lat], zoom: 14, pitch: is3D ? ROUTE_PITCH : 0 });
      }
      toast(`Starting from ${hit.node.name} (${Math.round(hit.distance)} m away).`);
      setOrigin(hit.node.id);
    },
    () => toast('Couldn’t get your location. Tap a place on the map to start from there.'),
    { enableHighAccuracy: true, timeout: 10000 },
  );
});

$('#toggle-3d').addEventListener('click', () => {
  if (!map) return;
  is3D = !is3D;
  map.setTerrain(is3D ? { source: 'dem', exaggeration: 1.25 } : null);
  map.easeTo({ pitch: is3D ? HOME_VIEW.pitch : 0, bearing: is3D ? map.getBearing() : 0, duration: 800 });
  $('#toggle-3d').textContent = is3D ? '2D' : '3D';
  $('#toggle-3d').setAttribute('aria-pressed', String(is3D));
});

$('#layers').addEventListener('click', () => { $('#layer-menu').hidden = !$('#layer-menu').hidden; });
document.querySelectorAll('input[name=base]').forEach((r) => r.addEventListener('change', () => setBasemap(r.value)));
$('#real-pistes').addEventListener('change', (e) => map?.setLayoutProperty('pistes', 'visibility', e.target.checked ? 'visible' : 'none'));
$('#show-network').addEventListener('change', (e) => {
  for (const id of NET_LAYERS) map?.setLayoutProperty(id, 'visibility', e.target.checked ? 'visible' : 'none');
});

$('#sheet-handle').addEventListener('click', () => {
  $('#sheet').classList.toggle('collapsed');
  setTimeout(() => focusResult(selected), 50);
});

function rerun() {
  if (lastSearch) run(lastSearch.criteria, lastSearch.label);
}

// ---------------------------------------------------------------- search & results

function run(criteria, label) {
  lastSearch = { criteria, label };
  lastResults = search(graph, {
    ...criteria,
    origin: $('#origin').value,
    profile: profile(),
    depart: toMinutes($('#time').value || '11:30'),
  });
  showSheet();
  $('#understood').textContent = `${label} · ${lastResults.length} found`;
  renderResults();
  renderPins();
  select(0);
}

function showSheet() {
  $('#sheet').hidden = false;
  $('#sheet').classList.remove('collapsed');
  document.body.classList.add('has-results');
}

function renderResults() {
  const list = $('#results');
  if (!lastResults.length) {
    list.replaceChildren(el('li', { class: 'empty' }, 'Nothing open that you can reach from here at that time. Try another start point, an earlier time, or a higher ability level.'));
    return;
  }
  list.replaceChildren(...lastResults.map((r, i) => {
    const node = nodeById.get(r.poi.node);
    const chips = el('div', { class: 'chips' },
      r.route.hardest ? el('span', { class: `chip lvl ${r.route.hardest}` }, `hardest: ${r.route.hardest}`) : null,
      ...r.poi.tags.map((t) => el('span', { class: 'chip' }, t)),
      ...r.missingTags.filter((t) => t !== 'apres').map((t) => el('span', { class: 'chip miss', title: 'Doesn’t match this preference' }, t)),
      r.poi.price ? el('span', { class: 'chip' }, '€'.repeat(r.poi.price)) : null,
    );
    const li = el('li', { class: 'result', tabindex: '0' },
      el('span', { class: 'num' }, String(i + 1)),
      el('h3', {}, r.poi.name),
      el('span', { class: 'eta' }, r.minutes === 0 ? 'Here' : `${r.minutes} min`),
      el('div', { class: 'body' },
        el('div', { class: 'meta' }, `${node.name} · arrive ${r.arrival} · open ${r.poi.open}–${r.poi.close}`),
        chips,
        ...r.warnings.map((w) => el('div', { class: 'warn' }, `⚠️ ${w}`)),
        r.route.steps.length
          ? el('ol', { class: 'steps' }, ...r.route.steps.map((s) => el('li', {}, el('time', {}, s.depart), s.text)))
          : null),
    );
    li.addEventListener('click', () => select(i));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') select(i); });
    return li;
  }));
}

function clearPins() {
  while (pins.length) pins.pop().remove();
  if (!map?.getSource('route')) return;
  map.getSource('route').setData({ type: 'FeatureCollection', features: [] });
  for (const id of NET_LAYERS) map.setPaintProperty(id, 'line-opacity', 1);
}

// Results at the same place share a position, so fan their pins out slightly.
function renderPins() {
  clearPins();
  if (!map) return;
  const perNode = new Map();
  lastResults.forEach((r, i) => {
    const node = nodeById.get(r.poi.node);
    const k = perNode.get(node.id) ?? 0;
    perNode.set(node.id, k + 1);
    const icon = ICON[r.poi.subtype] ?? ICON[r.poi.category];
    const elem = el('div', { class: 'pin', title: `${i + 1}. ${r.poi.name}` }, el('span', {}, icon));
    elem.addEventListener('click', (ev) => { ev.stopPropagation(); select(i); });
    pins.push(new maplibregl.Marker({ element: elem, anchor: 'bottom', offset: [k * 26 - 14, -6] })
      .setLngLat([node.lon, node.lat])
      .addTo(map));
  });
}

function select(i) {
  selected = i;
  document.querySelectorAll('.result').forEach((li, j) => li.classList.toggle('selected', j === i));
  pins.forEach((m, j) => {
    m.getElement().classList.toggle('selected', j === i);
    m.getElement().classList.toggle('dim', j !== i);
  });
  document.querySelectorAll('.result')[i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  focusResult(i);
}

function focusResult(i) {
  const r = lastResults[i];
  if (!map || !r) return;
  const route = routeGeoJSON(r.route.path, network.lines);
  const draw = () => {
    map.getSource('route').setData(route);
    for (const id of NET_LAYERS) map.setPaintProperty(id, 'line-opacity', route.features.length ? 0.4 : 1);
  };
  if (map.getSource('route')) draw(); else map.once('load', draw);

  const origin = nodeById.get($('#origin').value);
  const dest = nodeById.get(r.poi.node);
  const coords = [[origin.lon, origin.lat], [dest.lon, dest.lat], ...route.features.flatMap((f) => f.geometry.coordinates)];
  const [[w, s], [e, n]] = bounds(coords);
  const pad = 0.012; // ~1 km, so a result "here" still shows its surroundings
  map.fitBounds([[w - pad, s - pad], [e + pad, n + pad]], {
    padding: mapPadding(),
    pitch: is3D ? ROUTE_PITCH : 0,
    bearing: map.getBearing(),
    maxZoom: 14,
    duration: 1200,
  });
}

// Keep the route clear of the floating panels.
function mapPadding() {
  const panel = $('#panel').getBoundingClientRect();
  if (window.innerWidth >= 900) return { top: 60, bottom: 60, left: panel.right + 40, right: 90 };
  const search = $('.search').getBoundingClientRect();
  const sheet = $('#sheet');
  const sheetTop = sheet.hidden || sheet.classList.contains('collapsed') ? window.innerHeight - 70 : sheet.getBoundingClientRect().top;
  return { top: search.bottom + 30, bottom: window.innerHeight - sheetTop + 40, left: 30, right: 70 };
}

// ---------------------------------------------------------------- helpers

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...children.filter((c) => c !== null && c !== undefined));
  return e;
}

function button(label, onClick) {
  const b = el('button', { type: 'button' }, label);
  b.addEventListener('click', onClick);
  return b;
}

let toastTimer;
function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

syncProfile();
