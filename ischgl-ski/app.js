/* Ischgl Ski Nav — piste map + lift/run routing for the Silvretta Arena (Ischgl / Samnaun).
 * Piste, lift and hut data comes live from OpenStreetMap (Overpass API) and is cached on the phone. */
'use strict';

// ---------------------------------------------------------------- constants
const BBOX = [46.915, 10.25, 47.03, 10.43];            // south, west, north, east
const CENTER = [46.978, 10.325];
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const DATA_VERSION = 1;
const DATA_KEY = 'skinav-data-v' + DATA_VERSION;
const DATA_MAX_AGE = 10 * 864e5;                        // refresh in background after 10 days
const FALLBACK_PLACES = {
  ischgl: { lat: 47.0128, lon: 10.2922, name: 'Ischgl village' },
  samnaun: { lat: 46.9445, lon: 10.3640, name: 'Samnaun' },
};

const LEVELS = {
  1: { label: 'Blue', color: '#1d6fe0' },
  2: { label: 'Red', color: '#e02424' },
  3: { label: 'Black', color: '#111111' },
  4: { label: 'Ski route', color: '#f08c00' },
};
const ABILITY = [
  { v: 1, label: 'Blues only', dots: [1] },
  { v: 2, label: 'Blue + red', dots: [1, 2] },
  { v: 3, label: 'Up to black', dots: [1, 2, 3] },
  { v: 4, label: 'Anything + ski routes', dots: [1, 2, 3, 4] },
];
// Average speeds incl. stopping to regroup a group of 8 (m/s)
const PISTE_SPEED = { 0: 2, 1: 4.5, 2: 5, 3: 4.5, 4: 3.5 };
const WALK_SPEED = 1.0;
const LIFTS = {
  cable_car:   { label: 'Cable car',  speed: 8,   wait: 240, down: true,  icon: '🚠' },
  gondola:     { label: 'Gondola',    speed: 5,   wait: 150, down: true,  icon: '🚡' },
  mixed_lift:  { label: 'Gondola/chair', speed: 5, wait: 150, down: true, icon: '🚡' },
  chair_lift:  { label: 'Chairlift',  speed: 4.5, wait: 150, down: false, icon: '🪑' },
  drag_lift:   { label: 'Drag lift',  speed: 3,   wait: 60,  down: false, icon: '⤴️' },
  't-bar':     { label: 'T-bar',      speed: 3,   wait: 60,  down: false, icon: '⤴️' },
  'j-bar':     { label: 'J-bar',      speed: 3,   wait: 60,  down: false, icon: '⤴️' },
  platter:     { label: 'Button lift', speed: 3,  wait: 60,  down: false, icon: '⤴️' },
  rope_tow:    { label: 'Rope tow',   speed: 2,   wait: 30,  down: false, icon: '⤴️' },
  magic_carpet:{ label: 'Magic carpet', speed: 0.8, wait: 30, down: false, icon: '⤴️' },
};
const POI_ICON = { food: '🍴', bar: '🍺', wc: '🚻', station: '🚡', peak: '⛰️', village: '🏘️' };
const POI_LABEL = { food: 'Hut / restaurant', bar: 'Bar', wc: 'Toilets', station: 'Lift station', peak: 'Peak', village: 'Village' };

// ---------------------------------------------------------------- small helpers
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function dist(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function lineLen(pts) { let d = 0; for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); return d; }
const fmtDist = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.max(10, Math.round(m / 10) * 10) + ' m');
const fmtMin = (s) => { const m = Math.max(1, Math.round(s / 60)); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
const fmtClock = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function ago(t) { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.floor(m / 60); return h < 24 ? h + ' h ago' : Math.floor(h / 24) + ' d ago'; }
function loadLS(k, def) { try { const v = localStorage.getItem(k); return v ? Object.assign(def, JSON.parse(v)) : def; } catch (e) { return def; } }
function saveLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full */ } }
function inArea(p, pad = 0.03) { return p && p.lat > BBOX[0] - pad && p.lat < BBOX[2] + pad && p.lon > BBOX[1] - pad && p.lon < BBOX[3] + pad; }

let toastTimer;
function toast(msg, ms = 2800) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------------------------------------------------------------- state
const settings = loadLS('skinav-settings', { name: '', level: 2, base: 'topo' });
const pins = loadLS('skinav-pins', {});        // name -> {lat, lon, t, label, meet}
const state = {
  data: null, graph: null, me: null, follow: false,
  routeFrom: null, lastRouteTarget: null, pickingStart: null,
  targets: [],
};

// ---------------------------------------------------------------- map setup
const map = L.map('map', { zoomControl: false, attributionControl: true, maxZoom: 18, minZoom: 10, tap: true })
  .setView(CENTER, 13);
const bases = {
  topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    subdomains: 'abc', maxNativeZoom: 17, maxZoom: 18, crossOrigin: 'anonymous',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  }),
  osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxNativeZoom: 19, maxZoom: 18, crossOrigin: 'anonymous',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }),
};
let baseLayer = bases[settings.base] || bases.topo;
baseLayer.addTo(map);
let tileErrors = 0;
bases.topo.on('tileerror', () => {
  if (navigator.onLine && ++tileErrors === 12 && settings.base === 'topo') { setBase('osm', false); toast('Topo map unavailable – switched to street map'); }
});
function setBase(b, persist = true) { map.removeLayer(baseLayer); baseLayer = bases[b]; baseLayer.addTo(map); baseLayer.bringToBack(); if (persist) { settings.base = b; saveLS('skinav-settings', settings); } }

const renderer = L.canvas({ padding: 0.5, tolerance: 8 });
const layers = {
  areas: L.layerGroup().addTo(map),
  pistes: L.layerGroup().addTo(map),
  lifts: L.layerGroup().addTo(map),
  refLabels: L.layerGroup(),
  liftLabels: L.layerGroup(),
  pois: L.layerGroup(),
  peaks: L.layerGroup(),
  villages: L.layerGroup().addTo(map),
  route: L.layerGroup().addTo(map),
  friends: L.layerGroup().addTo(map),
  me: L.layerGroup().addTo(map),
};
map.on('zoomend', updateZoomLayers);
function updateZoomLayers() {
  const z = map.getZoom();
  const tog = (l, on) => (on ? map.hasLayer(l) || l.addTo(map) : map.hasLayer(l) && map.removeLayer(l));
  tog(layers.refLabels, z >= 14);
  tog(layers.liftLabels, z >= 15);
  tog(layers.pois, z >= 14);
  tog(layers.peaks, z >= 13);
}

// ---------------------------------------------------------------- data: fetch + process + cache
function overpassQuery() {
  const b = BBOX.join(',');
  return `[out:json][timeout:120];
(
  way["piste:type"~"^(downhill|connection)$"](${b});
  rel["piste:type"="downhill"](${b});
  way["aerialway"](${b});
  node["aerialway"="station"]["name"](${b});
  node["amenity"~"^(restaurant|bar|cafe|pub|fast_food|toilets|biergarten)$"](${b});
  way["amenity"~"^(restaurant|bar|cafe|pub|fast_food|biergarten)$"](${b});
  node["tourism"="alpine_hut"](${b});
  node["natural"="peak"]["name"](${b});
  node["place"~"^(village|town|hamlet)$"](${b});
);
out geom;`;
}

async function fetchOverpass() {
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 100000);
      const r = await fetch(url, {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(overpassQuery()),
      });
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j.elements || !j.elements.length) throw new Error('No data returned');
      return j;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Could not reach map server');
}

function pisteLevel(t) {
  const d = (t['piste:difficulty'] || '').toLowerCase();
  const g = (t['piste:grooming'] || '').toLowerCase();
  if (d === 'freeride' || d === 'extreme' || g === 'backcountry' || g === 'no') return 4;
  if (d === 'novice' || d === 'easy') return 1;
  if (d === 'advanced' || d === 'expert') return 3;
  return 2; // intermediate or unknown
}
function parseDuration(v) { // OSM aerialway:duration is in minutes ("8", "7.5" or "mm:ss")
  if (!v) return 0;
  const m = String(v).match(/^(\d+):(\d+)$/);
  if (m) return +m[1] * 60 + +m[2];
  const n = parseFloat(v);
  return isFinite(n) && n > 0 && n < 60 ? n * 60 : 0;
}
function geomPts(g) { return (g || []).filter(Boolean).map((p) => [r5(p.lat), r5(p.lon)]); }
function centroid(pts) { let a = 0, b = 0; pts.forEach((p) => { a += p[0]; b += p[1]; }); return [r5(a / pts.length), r5(b / pts.length)]; }

function processOverpass(json) {
  const pistes = [], lifts = [], pois = [], rels = [];
  const byWay = new Map();
  const mkPiste = (id, t, geom) => {
    const p = geomPts(geom);
    if (p.length < 2) return null;
    const closed = p.length > 3 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1];
    return {
      id, n: t['piste:name'] || t.name || '', r: t['piste:ref'] || t.ref || '', l: pisteLevel(t),
      a: t.area === 'yes' || (closed && t.area !== 'no') ? 1 : 0, c: t['piste:type'] === 'connection' ? 1 : 0, p,
    };
  };
  for (const el of json.elements) {
    const t = el.tags || {};
    if (el.type === 'way' && t['piste:type']) {
      const p = mkPiste(el.id, t, el.geometry);
      if (p) { pistes.push(p); byWay.set(el.id, p); }
      continue;
    }
    if (el.type === 'relation' && t['piste:type'] === 'downhill') { rels.push(el); continue; }
    if (el.type === 'way' && t.aerialway && LIFTS[t.aerialway]) {
      const p = geomPts(el.geometry);
      if (p.length >= 2) lifts.push({ id: el.id, n: t.name || t.ref || '', t: t.aerialway, dur: parseDuration(t['aerialway:duration']), p });
      continue;
    }
    let kind = null;
    if (t.aerialway === 'station') kind = 'station';
    else if (t.amenity === 'toilets') kind = 'wc';
    else if (/^(bar|pub|biergarten)$/.test(t.amenity || '')) kind = 'bar';
    else if (t.amenity || t.tourism === 'alpine_hut') kind = 'food';
    else if (t.natural === 'peak') kind = 'peak';
    else if (t.place) kind = 'village';
    if (!kind) continue;
    const name = t.name || (kind === 'wc' ? 'Toilets' : '');
    if (!name) continue;
    let lat = el.lat, lon = el.lon;
    if (el.type === 'way') { const p = geomPts(el.geometry); if (!p.length) continue; [lat, lon] = centroid(p); }
    if (lat == null) continue;
    const poi = { n: name, k: kind, lat: r5(lat), lon: r5(lon) };
    if (kind === 'peak' && t.ele) poi.e = Math.round(parseFloat(t.ele));
    if (kind === 'village') poi.pl = t.place;
    pois.push(poi);
  }
  // Route relations: give member ways the relation's name/ref/difficulty
  for (const r of rels) {
    for (const m of r.members || []) {
      if (m.type !== 'way') continue;
      const existing = byWay.get(m.ref);
      if (existing) {
        if (!existing.n) existing.n = r.tags['piste:name'] || r.tags.name || '';
        if (!existing.r) existing.r = r.tags['piste:ref'] || r.tags.ref || '';
        continue;
      }
      if (!m.geometry) continue;
      const p = mkPiste(m.ref, r.tags, m.geometry);
      if (p) { pistes.push(p); byWay.set(m.ref, p); }
    }
  }
  return { v: DATA_VERSION, t: Date.now(), pistes, lifts, pois };
}

async function saveData(d) {
  const s = JSON.stringify(d);
  try { localStorage.setItem(DATA_KEY, s); return; } catch (e) { /* too big for localStorage, use Cache API */ }
  try {
    const c = await caches.open('skinav-data');
    await c.put('./__skinav-data.json', new Response(s, { headers: { 'content-type': 'application/json' } }));
  } catch (e) { console.warn('Could not cache data', e); }
}
async function loadData() {
  try { const s = localStorage.getItem(DATA_KEY); if (s) return JSON.parse(s); } catch (e) { /* ignore */ }
  try {
    const c = await caches.open('skinav-data');
    const r = await c.match('./__skinav-data.json');
    if (r) return await r.json();
  } catch (e) { /* ignore */ }
  return null;
}

async function refreshData(showOverlay) {
  if (showOverlay) $('#loading').classList.remove('hidden');
  try {
    const raw = await fetchOverpass();
    const d = processOverpass(raw);
    if (!d.pistes.length) throw new Error('No pistes found');
    await saveData(d);
    useData(d);
    toast(`Map updated: ${d.pistes.length} piste sections, ${d.lifts.length} lifts`);
    return true;
  } catch (e) {
    console.error(e);
    if (!state.data) showLoadError(e);
    else toast('Could not update map data (offline?) – using saved copy');
    return false;
  } finally {
    $('#loading').classList.add('hidden');
  }
}
function showLoadError(e) {
  showSheet('Couldn’t load the piste map', `
    <p>The app needs an internet connection the first time, to download the pistes and lifts (after that it works offline).</p>
    <p class="note">Error: ${esc(e && e.message)}</p>
    <button class="btn block" data-act="retry">Try again</button>`);
}

// ---------------------------------------------------------------- routing graph
class Grid {
  constructor(cell = 0.001) { this.c = cell; this.m = new Map(); }
  add(i, lat, lon) {
    const k = Math.floor(lat / this.c) + '|' + Math.floor(lon / this.c);
    let a = this.m.get(k); if (!a) this.m.set(k, (a = [])); a.push(i);
  }
  near(lat, lon, r) {
    const out = [], dLat = r / 111320, dLon = r / (111320 * Math.cos(lat * Math.PI / 180));
    const y0 = Math.floor((lat - dLat) / this.c), y1 = Math.floor((lat + dLat) / this.c);
    const x0 = Math.floor((lon - dLon) / this.c), x1 = Math.floor((lon + dLon) / this.c);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const a = this.m.get(y + '|' + x); if (a) for (const i of a) out.push(i); }
    return out;
  }
}

function buildGraph(data) {
  const lat = [], lon = [], adj = [], keys = new Map();
  const node = (la, lo) => {
    const k = la + ',' + lo; let i = keys.get(k);
    if (i === undefined) { i = lat.length; keys.set(k, i); lat.push(la); lon.push(lo); adj.push([]); }
    return i;
  };
  const edge = (a, b, e) => { if (a !== b) adj[a].push(Object.assign({ to: b }, e)); };
  const nodePistes = [];
  const pisteEnds = [];

  data.pistes.forEach((p, pi) => {
    if (p.a) return;
    const ids = p.p.map(([a, b]) => node(a, b));
    const lvl = p.c ? 0 : p.l, sp = PISTE_SPEED[lvl];
    for (let j = 0; j < ids.length - 1; j++) {
      const d = dist(p.p[j][0], p.p[j][1], p.p[j + 1][0], p.p[j + 1][1]);
      const e = { cost: d / sp, dist: d, k: p.c ? 'walk' : 'piste', ref: pi, lvl };
      edge(ids[j], ids[j + 1], e);
      if (p.c) edge(ids[j + 1], ids[j], e);
    }
    ids.forEach((i) => { (nodePistes[i] || (nodePistes[i] = [])).push(pi); });
    pisteEnds.push([pi, ids[0], ids[ids.length - 1]]);
  });

  const liftEnd = new Map(); // node -> 'bot' | 'top'
  data.lifts.forEach((l, li) => {
    const a = l.p[0], b = l.p[l.p.length - 1];
    const bot = node(a[0], a[1]), top = node(b[0], b[1]);
    const info = LIFTS[l.t], len = lineLen(l.p);
    const ride = l.dur || len / info.speed;
    edge(bot, top, { cost: ride + info.wait, dist: len, k: 'lift', ref: li, lvl: 0, ride });
    if (info.down) edge(top, bot, { cost: ride + info.wait + 240, dist: len, k: 'liftdown', ref: li, lvl: 0, ride });
    if (!liftEnd.has(bot)) liftEnd.set(bot, 'bot');
    liftEnd.set(top, 'top');
  });

  const pisteGrid = new Grid();
  nodePistes.forEach((arr, i) => { if (arr) pisteGrid.add(i, lat[i], lon[i]); });
  const walk = (a, b, d, pen, speed = WALK_SPEED) => edge(a, b, { cost: d / speed + pen, dist: d, k: 'walk', lvl: 0 });
  // nearest node of each piste within r metres of node i
  const nearestPerPiste = (i, r, exclude) => {
    const best = new Map();
    for (const j of pisteGrid.near(lat[i], lon[i], r)) {
      if (j === i) continue;
      const d = dist(lat[i], lon[i], lat[j], lon[j]);
      if (d > r) continue;
      for (const pi of nodePistes[j]) {
        if (pi === exclude) continue;
        const cur = best.get(pi);
        if (!cur || d < cur.d) best.set(pi, { j, d });
      }
    }
    return [...best.values()];
  };

  // Lift stations <-> pistes. Walking *up* to a lift top is only allowed over very short distances.
  for (const [i, role] of liftEnd) {
    for (const { j, d } of nearestPerPiste(i, 130, -1)) {
      walk(i, j, d, 20);                                // off the lift onto a piste / from bottom station to nearby piste
      if (role === 'bot' || d < 40) walk(j, i, d, 20);  // ski into a bottom station
    }
  }
  // Lift station <-> lift station transfers (hubs like Idalp, village valley stations)
  const liftGrid = new Grid();
  for (const i of liftEnd.keys()) liftGrid.add(i, lat[i], lon[i]);
  for (const [i] of liftEnd) {
    for (const j of liftGrid.near(lat[i], lon[i], 160)) {
      if (j === i) continue;
      const d = dist(lat[i], lon[i], lat[j], lon[j]);
      if (d > 160) continue;
      if (liftEnd.get(j) === 'top' && liftEnd.get(i) !== 'top' && d > 40) continue;
      walk(i, j, d, 30);
    }
  }
  // Piste junctions not sharing an OSM node
  for (const [pi, s, e] of pisteEnds) {
    for (const { j, d } of nearestPerPiste(e, 45, pi)) walk(e, j, d, 5, 2);
    for (const { j, d } of nearestPerPiste(s, 45, pi)) walk(j, s, d, 5, 2);
  }

  const allGrid = new Grid(0.002);
  for (let i = 0; i < lat.length; i++) allGrid.add(i, lat[i], lon[i]);
  return { lat, lon, adj, grid: allGrid, liftEnd };
}

// binary heap keyed on cost
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, topK = k[0], topV = v[0], lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return [topK, topV];
  }
}

function candidates(G, pt, radii) {
  for (const r of radii) {
    const out = [];
    for (const i of G.grid.near(pt.lat, pt.lon, r)) {
      const d = dist(pt.lat, pt.lon, G.lat[i], G.lon[i]);
      if (d <= r) out.push({ i, d });
    }
    if (out.length) return out.sort((a, b) => a.d - b.d).slice(0, 40);
  }
  return [];
}

function findRoute(from, to, maxLevel) {
  const G = state.graph; if (!G) return null;
  const S = candidates(G, from, [60, 150, 400, 1200, 3000]);
  const T = candidates(G, to, to.radius ? [to.radius, to.radius * 3, 3000] : [60, 200, 600, 3000]);
  if (!S.length || !T.length) return null;
  const n = G.lat.length, cost = new Float64Array(n).fill(Infinity), prevE = new Array(n), prevN = new Int32Array(n).fill(-1);
  const h = new Heap();
  for (const s of S) { const c = s.d / WALK_SPEED; if (c < cost[s.i]) { cost[s.i] = c; h.push(c, s.i); } }
  while (h.size) {
    const [c, u] = h.pop();
    if (c > cost[u]) continue;
    for (const e of G.adj[u]) {
      if (e.lvl > maxLevel) continue;
      const nc = c + e.cost;
      if (nc < cost[e.to]) { cost[e.to] = nc; prevE[e.to] = e; prevN[e.to] = u; h.push(nc, e.to); }
    }
  }
  let best = null;
  for (const t of T) { const c = cost[t.i] + t.d / WALK_SPEED; if (c < Infinity && (!best || c < best.c)) best = { ...t, c }; }
  if (!best) return null;
  const edges = [];
  for (let v = best.i; prevN[v] !== -1; v = prevN[v]) edges.push({ from: prevN[v], e: prevE[v] });
  edges.reverse();
  const startNode = edges.length ? edges[0].from : best.i;
  return { edges, total: best.c, endNode: best.i, endWalk: best.d, startNode, from, to };
}

function buildSteps(route) {
  const G = state.graph, D = state.data, steps = [];
  for (const { from, e } of route.edges) {
    const last = steps[steps.length - 1];
    const a = [G.lat[from], G.lon[from]], b = [G.lat[e.to], G.lon[e.to]];
    let key = e.k + ':' + (e.ref == null ? '' : e.ref);
    if (e.k === 'piste') { const p = D.pistes[e.ref]; key = 'piste:' + (p.r || p.n ? p.r + '|' + p.n + '|' + p.l : e.ref); }
    if (e.k === 'walk') key = 'walk';
    if (last && last.key === key) { last.dist += e.dist; last.time += e.cost; last.pts.push(b); continue; }
    steps.push({ key, k: e.k, ref: e.ref, lvl: e.lvl, dist: e.dist, time: e.cost, pts: [a, b] });
  }
  // fold tiny walks into neighbours; drop if the route is otherwise empty
  return steps.filter((s, i) => !(s.k === 'walk' && s.dist < 30 && steps.length > 1));
}

function describeStep(s) {
  const D = state.data;
  if (s.k === 'lift' || s.k === 'liftdown') {
    const l = D.lifts[s.ref], info = LIFTS[l.t], name = l.n || info.label;
    const up = s.k === 'lift';
    return {
      badge: info.icon, color: '#5b3cc4',
      title: up ? `Take ${name} up` : `Ride ${name} back down`,
      sub: `${info.label} · ${fmtMin(s.time)} incl. queue` + (up ? '' : ' · saves your legs'),
    };
  }
  if (s.k === 'piste') {
    const p = D.pistes[s.ref], lv = LEVELS[p.l];
    const label = [p.r ? 'Run ' + p.r : '', p.n].filter(Boolean).join(' – ') || `${lv.label} run`;
    return { badge: esc(p.r || '⛷'), color: lv.color, title: label, sub: `${lv.label} · ${fmtDist(s.dist)} · ~${fmtMin(s.time)}` };
  }
  return { badge: '🚶', color: '#98a2b3', title: `Walk / skate ${fmtDist(s.dist)}`, sub: 'Short hop between lifts and runs' };
}

// ---------------------------------------------------------------- rendering the resort
function useData(d) {
  state.data = d;
  const t0 = performance.now();
  state.graph = buildGraph(d);
  console.log('graph', state.graph.lat.length, 'nodes in', Math.round(performance.now() - t0), 'ms');
  drawResort();
  if (state.lastRouteTarget) routeTo(state.lastRouteTarget, { quiet: true });
}

function pisteStyle(p) {
  const lv = LEVELS[p.l], over = p.l > settings.level;
  return { renderer, color: lv.color, weight: p.l === 3 ? 3.5 : 4, opacity: over ? 0.35 : 0.95, dashArray: p.l === 4 ? '8 6' : null, lineCap: 'round' };
}

function drawResort() {
  const d = state.data;
  Object.values(layers).forEach((l) => l !== layers.me && l !== layers.route && l !== layers.friends && l.clearLayers());
  d.pistes.forEach((p, pi) => {
    if (p.a) {
      L.polygon(p.p, { renderer, color: LEVELS[p.l].color, weight: 0, fillOpacity: 0.12, interactive: false }).addTo(layers.areas);
      return;
    }
    const line = L.polyline(p.p, pisteStyle(p)).addTo(layers.pistes);
    line._pi = pi;
    line.on('click', (e) => openPistePopup(pi, e.latlng));
  });
  d.lifts.forEach((l, li) => {
    const info = LIFTS[l.t];
    L.polyline(l.p, { renderer, color: '#fff', weight: 5, opacity: 0.9, interactive: false }).addTo(layers.lifts);
    const line = L.polyline(l.p, { renderer, color: '#2b2b2b', weight: 2.5, dashArray: l.t === 'chair_lift' || info.down ? null : '6 4' }).addTo(layers.lifts);
    line.on('click', (e) => openLiftPopup(li, e.latlng));
    [l.p[0], l.p[l.p.length - 1]].forEach((pt) => L.circleMarker(pt, { renderer, radius: 3.5, color: '#2b2b2b', weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(layers.lifts));
    if (l.n) {
      const mid = l.p[Math.floor(l.p.length / 2)];
      const m = l.p.length === 2 ? [(l.p[0][0] + l.p[1][0]) / 2, (l.p[0][1] + l.p[1][1]) / 2] : mid;
      L.marker(m, { icon: L.divIcon({ className: '', html: `<span class="lift-label">${info.icon} ${esc(l.n)}</span>`, iconSize: null }), interactive: false }).addTo(layers.liftLabels);
    }
  });
  // piste number labels on the longest section of each numbered run
  const longest = new Map();
  d.pistes.forEach((p) => {
    if (!p.r || p.a) return;
    const k = p.r + '|' + p.l, len = lineLen(p.p), cur = longest.get(k);
    if (!cur || len > cur.len) longest.set(k, { p, len });
  });
  for (const { p } of longest.values()) {
    const mid = p.p[Math.floor(p.p.length / 2)];
    L.marker(mid, { icon: L.divIcon({ className: '', html: `<span class="ref-label" style="background:${LEVELS[p.l].color}">${esc(p.r)}</span>`, iconSize: null }), interactive: false }).addTo(layers.refLabels);
  }
  d.pois.forEach((poi, i) => {
    if (poi.k === 'village') {
      if (poi.pl === 'hamlet') return;
      L.marker([poi.lat, poi.lon], { icon: L.divIcon({ className: '', html: `<span class="village-label">${esc(poi.n)}</span>`, iconSize: null }) })
        .on('click', () => openPoiPopup(i)).addTo(layers.villages);
      return;
    }
    const target = poi.k === 'peak' ? layers.peaks : layers.pois;
    L.marker([poi.lat, poi.lon], { icon: L.divIcon({ className: '', html: `<span class="poi">${POI_ICON[poi.k]}</span>`, iconSize: null }) })
      .on('click', () => openPoiPopup(i)).addTo(target);
  });
  updateZoomLayers();
  drawFriends();
}

function restylePistes() {
  layers.pistes.eachLayer((l) => l.setStyle(pisteStyle(state.data.pistes[l._pi])));
  renderLevelPill();
}

// ---------------------------------------------------------------- popups
function targetBtn(t, label = 'Route here', cls = '') {
  const id = state.targets.push(t) - 1;
  return `<button class="btn small ${cls}" data-act="route" data-t="${id}">🧭 ${label}</button>`;
}
function shareBtn(t) {
  const id = state.targets.push(t) - 1;
  return `<button class="btn small light" data-act="meet" data-t="${id}">📣 Meet here</button>`;
}
function openPistePopup(pi, latlng) {
  const p = state.data.pistes[pi], lv = LEVELS[p.l];
  const title = [p.r ? 'Run ' + p.r : '', p.n].filter(Boolean).join(' – ') || `${lv.label} run`;
  const start = { lat: p.p[0][0], lon: p.p[0][1], name: 'top of ' + title, radius: 40 };
  L.popup().setLatLng(latlng).setContent(`
    <div class="pt"><span class="dot" style="background:${lv.color}"></span> ${esc(title)}</div>
    <div class="ps">${lv.label}${p.l > settings.level ? ' · <b>above your group level</b>' : ''} · this section ${fmtDist(lineLen(p.p))}</div>
    <div class="row">${targetBtn(start, 'Route to top of run')}</div>`).openOn(map);
}
function openLiftPopup(li, latlng) {
  const l = state.data.lifts[li], info = LIFTS[l.t], len = lineLen(l.p);
  const name = l.n || info.label;
  const bot = { lat: l.p[0][0], lon: l.p[0][1], name: name + ' (bottom)', radius: 25 };
  const top = { lat: l.p[l.p.length - 1][0], lon: l.p[l.p.length - 1][1], name: name + ' (top)', radius: 25 };
  L.popup().setLatLng(latlng).setContent(`
    <div class="pt">${info.icon} ${esc(name)}</div>
    <div class="ps">${info.label} · ${fmtDist(len)} · ~${fmtMin(l.dur || len / info.speed)} ride</div>
    <div class="row">${targetBtn(bot, 'To bottom')} ${targetBtn(top, 'To top', 'light')}</div>`).openOn(map);
}
function openPoiPopup(i) {
  const p = state.data.pois[i];
  const t = { lat: p.lat, lon: p.lon, name: p.n, radius: p.k === 'village' ? 600 : 150 };
  const extra = p.e ? ` · ${p.e} m` : '';
  L.popup({ offset: [0, -6] }).setLatLng([p.lat, p.lon]).setContent(`
    <div class="pt">${POI_ICON[p.k]} ${esc(p.n)}</div>
    <div class="ps">${POI_LABEL[p.k]}${extra}${state.me ? ' · ' + fmtDist(dist(state.me.lat, state.me.lon, p.lat, p.lon)) + ' away' : ''}</div>
    <div class="row">${targetBtn(t)} ${shareBtn(t)}</div>`).openOn(map);
}
map.on('contextmenu', (e) => {
  const t = { lat: r5(e.latlng.lat), lon: r5(e.latlng.lng), name: 'dropped pin' };
  const fromId = state.targets.push(t) - 1;
  L.popup().setLatLng(e.latlng).setContent(`
    <div class="pt">📌 This spot</div>
    <div class="row">${targetBtn(t)} <button class="btn small light" data-act="from" data-t="${fromId}">Start from here</button></div>
    <div class="row">${shareBtn(t)}</div>`).openOn(map);
});
map.on('click', (e) => {
  if (!state.pickingStart) return;
  const target = state.pickingStart; state.pickingStart = null;
  state.routeFrom = { lat: e.latlng.lat, lon: e.latlng.lng, name: 'chosen start' };
  routeTo(target);
});

// ---------------------------------------------------------------- routing UI
function currentStart() {
  if (state.routeFrom) return state.routeFrom;
  if (state.me && inArea(state.me)) return { lat: state.me.lat, lon: state.me.lon, name: 'your location', gps: true };
  return null;
}

function routeTo(target, opts = {}) {
  if (!state.graph) { toast('Map data is still loading…'); return; }
  map.closePopup();
  state.lastRouteTarget = target;
  const from = currentStart();
  if (!from) {
    state.pickingStart = target;
    showSheet('Where are you starting from?', `
      <p>${state.me ? 'Your GPS says you’re not in the ski area yet.' : 'I don’t have your GPS position yet.'}
      <b>Tap the map</b> where you are starting from (or long-press anywhere for more options).</p>
      <div class="row"><button class="btn light" data-act="start-ischgl">Start from Ischgl village</button></div>
      <p class="note">Tip: allow location access so routes start from where you are.</p>`);
    return;
  }
  let route = findRoute(from, target, settings.level);
  let usedLevel = settings.level;
  if (!route || !route.edges.length) {
    for (let lv = settings.level + 1; lv <= 4 && (!route || !route.edges.length); lv++) { route = findRoute(from, target, lv); usedLevel = lv; }
  }
  if (!route) {
    showSheet('No route found', `<p>I couldn’t link <b>${esc(from.name)}</b> to <b>${esc(target.name)}</b> using the lift and piste map. The OpenStreetMap data may have a gap here – check the resort map boards.</p>`);
    layers.route.clearLayers();
    return;
  }
  drawRoute(route, target, from, usedLevel, opts);
}

function drawRoute(route, target, from, usedLevel, opts) {
  layers.route.clearLayers();
  const steps = buildSteps(route);
  const G = state.graph;
  const all = [[from.lat, from.lon]];
  steps.forEach((s) => {
    const d = describeStep(s);
    const style = s.k === 'walk' ? { color: '#475467', dashArray: '2 7', weight: 5 } :
      (s.k === 'piste' ? { color: d.color, weight: 6 } : { color: '#7a5af8', weight: 5, dashArray: '10 6' });
    L.polyline(s.pts, { color: '#fff', weight: style.weight + 6, opacity: 0.9, interactive: false }).addTo(layers.route);
    L.polyline(s.pts, Object.assign({ opacity: 1, interactive: false, lineCap: 'round' }, style)).addTo(layers.route);
    all.push(...s.pts);
  });
  const endPt = [G.lat[route.endNode], G.lon[route.endNode]];
  if (route.endWalk > 25) {
    L.polyline([endPt, [target.lat, target.lon]], { color: '#475467', dashArray: '2 7', weight: 4, interactive: false }).addTo(layers.route);
  }
  all.push([target.lat, target.lon]);
  L.marker([from.lat, from.lon], { icon: L.divIcon({ className: '', html: '<div class="endpoint" style="background:#12b76a"></div>', iconSize: null }), interactive: false }).addTo(layers.route);
  L.marker([target.lat, target.lon], { icon: L.divIcon({ className: '', html: '<div class="endpoint" style="background:#ff2d87"></div>', iconSize: null }), interactive: false }).addTo(layers.route);

  let km = 0, nLifts = 0, ride = 0;
  steps.forEach((s) => { if (s.k === 'piste') km += s.dist; if (s.k === 'lift' || s.k === 'liftdown') nLifts++; });
  ride = route.total;
  const arrive = new Date(Date.now() + ride * 1000);
  const warnLevel = usedLevel > settings.level
    ? `<div class="warn">⚠️ There’s no way to get there on <b>${ABILITY.find((a) => a.v === settings.level).label.toLowerCase()}</b> pistes only, so this route uses up to <b>${LEVELS[usedLevel].label.toLowerCase()}</b> runs. Alternatively take a lift down where possible.</div>` : '';
  const late = arrive.getHours() > 15 || (arrive.getHours() === 15 && arrive.getMinutes() > 30)
    ? '<div class="warn">⏰ It’s getting late – lifts start closing around 16:00. Check the last-lift times on the boards, especially for lifts back from Samnaun.</div>' : '';
  const html = `
    <div class="summary"><b>≈ ${fmtMin(ride)}</b> · arrive ~${fmtClock(arrive)}<br>
      ${fmtDist(km)} of skiing · ${nLifts} lift${nLifts === 1 ? '' : 's'} · from ${esc(from.name)}</div>
    ${warnLevel}${late}
    <ol class="steps">
      ${steps.map((s, i) => { const d = describeStep(s); return `<li data-act="step" data-i="${i}"><div class="badge" style="background:${d.color}">${d.badge}</div><div><div class="t">${esc(d.title)}</div><div class="s">${esc(d.sub)}</div></div></li>`; }).join('')}
      <li><div class="badge" style="background:#ff2d87">🏁</div><div><div class="t">${esc(target.name)}</div><div class="s">${route.endWalk > 25 ? fmtDist(route.endWalk) + ' walk from the piste' : 'You’re there'}</div></div></li>
    </ol>
    <div class="row">
      ${state.routeFrom ? '<button class="btn small light" data-act="from-gps">📍 Start from my GPS instead</button>' : ''}
      <button class="btn small light" data-act="clear-route">Clear route</button>
    </div>
    <p class="note">Times are rough (group pace + lift queues). Routes come from OpenStreetMap – always follow piste signs and closures on the day.</p>`;
  state.routeSteps = steps;
  showSheet('Route to ' + target.name, html);
  if (!opts.quiet) map.fitBounds(L.latLngBounds(all), { paddingTopLeft: [20, 80], paddingBottomRight: [20, window.innerHeight * 0.45] });
}

// ---------------------------------------------------------------- sheet
function showSheet(title, html) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  $('#sheet').classList.remove('hidden', 'mini');
  $('#sheet-body').scrollTop = 0;
}
function hideSheet() { $('#sheet').classList.add('hidden'); state.pickingStart = null; }
$('#sheet-close').addEventListener('click', (e) => { e.stopPropagation(); hideSheet(); });
$('.sheet-head').addEventListener('click', () => $('#sheet').classList.toggle('mini'));

// ---------------------------------------------------------------- search
function searchItems() {
  const d = state.data; if (!d) return [];
  if (state._items && state._itemsFor === d) return state._items;
  const items = [], seen = new Set();
  d.pois.forEach((p) => {
    const k = p.k + '|' + norm(p.n);
    if (p.k === 'wc') return;
    if (seen.has(k)) return; seen.add(k);
    items.push({ n: p.n, ico: POI_ICON[p.k], sub: POI_LABEL[p.k] + (p.e ? ` · ${p.e} m` : ''), lat: p.lat, lon: p.lon, radius: p.k === 'village' ? 600 : 150, rank: p.k === 'station' || p.k === 'village' ? 0 : 1 });
  });
  d.lifts.forEach((l) => {
    if (!l.n) return;
    const k = 'lift|' + norm(l.n); if (seen.has(k)) return; seen.add(k);
    const info = LIFTS[l.t];
    items.push({ n: l.n, ico: info.icon, sub: info.label + ' (bottom station)', lat: l.p[0][0], lon: l.p[0][1], radius: 25, rank: 0 });
  });
  d.pistes.forEach((p) => {
    if (p.a || (!p.r && !p.n)) return;
    const title = [p.r ? 'Run ' + p.r : '', p.n].filter(Boolean).join(' – ');
    const k = 'piste|' + norm(title) + p.l; if (seen.has(k)) return; seen.add(k);
    items.push({ n: title, ico: `<span class="dot" style="background:${LEVELS[p.l].color}"></span>`, sub: LEVELS[p.l].label + ' run (top)', lat: p.p[0][0], lon: p.p[0][1], radius: 40, rank: 2, ref: norm(p.r) });
  });
  state._items = items; state._itemsFor = d;
  return items;
}
function nearestPoi(kinds) {
  const ref = state.me && inArea(state.me) ? state.me : { lat: map.getCenter().lat, lon: map.getCenter().lng };
  let best = null;
  (state.data ? state.data.pois : []).forEach((p) => {
    if (!kinds.includes(p.k)) return;
    const d = dist(ref.lat, ref.lon, p.lat, p.lon);
    if (!best || d < best.d) best = { p, d };
  });
  return best && best.p;
}
function homePlace(re, fb) {
  const v = state.data && state.data.pois.filter((p) => p.k === 'village' && re.test(p.n))
    .sort((a, b) => (a.pl === 'hamlet') - (b.pl === 'hamlet'))[0];
  return v ? { lat: v.lat, lon: v.lon, name: v.n + ' village', radius: 600 } : { ...fb, radius: 600 };
}
function itemLi(it) {
  const id = state.targets.push({ lat: it.lat, lon: it.lon, name: it.n, radius: it.radius }) - 1;
  const away = state.me && inArea(state.me) ? fmtDist(dist(state.me.lat, state.me.lon, it.lat, it.lon)) : '';
  return `<li data-act="show" data-t="${id}"><div class="ico">${it.ico}</div><div class="main"><div class="t">${esc(it.n)}</div><div class="s">${it.sub}</div></div><div class="end">${away}</div></li>`;
}
function renderSearch() {
  const q = norm($('#search').value.trim());
  if (!state.data) { showSheet('Search', '<p>Map data is still loading…</p>'); return; }
  if (!q) {
    const quick = [
      ['🏠', 'Back to Ischgl', 'home-ischgl'], ['🇨🇭', 'Over to Samnaun (duty free)', 'home-samnaun'],
      ['🍴', 'Nearest hut / restaurant', 'near-food'], ['🍺', 'Nearest bar', 'near-bar'], ['🚻', 'Nearest toilets', 'near-wc'],
    ];
    showSheet('Where to?', `<ul class="list">${quick.map(([i, t, a]) => `<li data-act="${a}"><div class="ico">${i}</div><div class="main"><div class="t">${t}</div></div></li>`).join('')}</ul>
      <p class="note">Or type the name of a hut, bar, lift or run number. Long-press anywhere on the map to route to that spot.</p>`);
    return;
  }
  const res = searchItems().map((it) => {
    const n = norm(it.n);
    let score = n.startsWith(q) ? 0 : n.includes(q) ? 1 : (it.ref && it.ref === q ? 0 : -1);
    if (score < 0) { const words = q.split(/\s+/); score = words.every((w) => n.includes(w)) ? 2 : -1; }
    return { it, score };
  }).filter((x) => x.score >= 0).sort((a, b) => a.score - b.score || a.it.rank - b.it.rank || a.it.n.localeCompare(b.it.n)).slice(0, 40);
  showSheet(res.length ? `${res.length} result${res.length > 1 ? 's' : ''}` : 'No matches',
    res.length ? `<ul class="list">${res.map((r) => itemLi(r.it)).join('')}</ul>` : '<p class="note">Try a different spelling, e.g. “Idalp”, “Trida”, “Pardatsch”.</p>');
}
$('#search').addEventListener('focus', renderSearch);
$('#search').addEventListener('input', renderSearch);
$('#search').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

// ---------------------------------------------------------------- location
const meMarker = L.marker([0, 0], { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, zIndexOffset: 1000 });
const meAcc = L.circle([0, 0], { radius: 1, color: '#1a73e8', weight: 1, fillOpacity: 0.12, interactive: false });
function startGps() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition((pos) => {
    const first = !state.me;
    state.me = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, t: Date.now() };
    meMarker.setLatLng([state.me.lat, state.me.lon]); meAcc.setLatLng([state.me.lat, state.me.lon]).setRadius(state.me.acc);
    if (!layers.me.hasLayer(meMarker)) { layers.me.addLayer(meAcc); layers.me.addLayer(meMarker); }
    if (state.follow) map.panTo([state.me.lat, state.me.lon]);
    if (first && inArea(state.me) && !state.lastRouteTarget) map.setView([state.me.lat, state.me.lon], 15);
  }, (err) => {
    if (err.code === 1) toast('Location is blocked – enable it in your browser settings to see yourself on the map', 4500);
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}
$('#btn-locate').addEventListener('click', () => {
  if (!state.me) { toast('Waiting for GPS…'); startGps(); return; }
  if (!inArea(state.me)) { toast(`You’re ${fmtDist(dist(state.me.lat, state.me.lon, CENTER[0], CENTER[1]))} from Ischgl – see you on the slopes!`); map.setView(CENTER, 13); return; }
  state.follow = !state.follow;
  $('#btn-locate').classList.toggle('active', state.follow);
  map.setView([state.me.lat, state.me.lon], Math.max(map.getZoom(), 15));
  toast(state.follow ? 'Following you' : 'Stopped following');
});
map.on('dragstart', () => { if (state.follow) { state.follow = false; $('#btn-locate').classList.remove('active'); } });

// ---------------------------------------------------------------- group / sharing
const baseUrl = () => location.origin + location.pathname;
function pinLink(lat, lon, name, label, meet) {
  return `${baseUrl()}#pin=${(+lat).toFixed(5)},${(+lon).toFixed(5)},${encodeURIComponent(name)},${Math.round(Date.now() / 1000)},${encodeURIComponent(label || '')},${meet ? 1 : 0}`;
}
async function shareText(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); toast('Copied – paste it into the group chat'); }
  catch (e) { prompt('Copy this and send it to the lads:', text); }
}
function requireName() {
  if (settings.name) return true;
  const n = prompt('What’s your name? (shown to the lads when you share)');
  if (!n) return false;
  settings.name = n.trim().slice(0, 20); saveLS('skinav-settings', settings);
  return true;
}
function shareMyLocation() {
  if (!state.me) { toast('No GPS fix yet – try again in a moment'); startGps(); return; }
  if (!requireName()) return;
  const near = nearestPoi(['station', 'food', 'bar']);
  const nearTxt = near && dist(state.me.lat, state.me.lon, near.lat, near.lon) < 400 ? ` near ${near.n}` : '';
  const link = pinLink(state.me.lat, state.me.lon, settings.name, nearTxt.trim(), false);
  shareText(`📍 ${settings.name} is here${nearTxt} (${fmtClock(new Date())})\nOpen in the ski app: ${link}\nGoogle Maps: https://maps.google.com/?q=${state.me.lat.toFixed(5)},${state.me.lon.toFixed(5)}`);
}
function shareMeetPoint(t) {
  if (!requireName()) return;
  const when = prompt(`Meet at ${t.name} – what time? (e.g. 12:30, or leave blank)`, '');
  if (when === null) return;
  const label = `Meet: ${t.name}${when ? ' @ ' + when : ''}`;
  const link = pinLink(t.lat, t.lon, label, settings.name, true);
  addPin(label, t.lat, t.lon, Date.now(), settings.name, true);
  shareText(`📣 ${label} (from ${settings.name})\nRoute there in the ski app: ${link}\nGoogle Maps: https://maps.google.com/?q=${(+t.lat).toFixed(5)},${(+t.lon).toFixed(5)}`);
}
function addPin(name, lat, lon, t, label, meet) {
  pins[name] = { lat, lon, t, label, meet: !!meet };
  saveLS('skinav-pins', pins);
  drawFriends();
}
function drawFriends() {
  layers.friends.clearLayers();
  Object.entries(pins).forEach(([name, p]) => {
    const short = p.meet ? '📣 ' + name.replace(/^Meet: /, '') : name + ' · ' + ago(p.t);
    L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: `<div class="friend"><div class="b ${p.meet ? 'meet' : ''}">${esc(short)}</div><div class="p"></div></div>`, iconSize: null }), zIndexOffset: 900 })
      .on('click', () => {
        L.popup({ offset: [0, -24] }).setLatLng([p.lat, p.lon]).setContent(`
          <div class="pt">${esc(name)}</div><div class="ps">${p.meet ? 'Set by ' + esc(p.label) : esc(p.label || '')} · shared ${ago(p.t)}</div>
          <div class="row">${targetBtn({ lat: p.lat, lon: p.lon, name, radius: 120 })}</div>`).openOn(map);
      }).addTo(layers.friends);
  });
}
function readHashPin() {
  const m = location.hash.match(/^#pin=([^&]+)/);
  if (!m) return;
  const [lat, lon, name, ts, label, meet] = m[1].split(',');
  const la = parseFloat(lat), lo = parseFloat(lon);
  if (!isFinite(la) || !isFinite(lo)) return;
  const n = decodeURIComponent(name || 'Friend').slice(0, 60);
  addPin(n, la, lo, ts ? +ts * 1000 : Date.now(), decodeURIComponent(label || ''), meet === '1');
  history.replaceState(null, '', baseUrl());
  map.setView([la, lo], 15);
  const id = state.targets.push({ lat: la, lon: lo, name: n, radius: 120 }) - 1;
  showSheet(n, `<p>${meet === '1' ? 'Meeting point' : 'Location'} shared ${ago(ts ? +ts * 1000 : Date.now())}.</p>
    <button class="btn block" data-act="route" data-t="${id}">🧭 Route there</button>`);
}
window.addEventListener('hashchange', readHashPin);

function openGroup() {
  const list = Object.entries(pins).sort((a, b) => b[1].t - a[1].t);
  const items = list.map(([name, p]) => {
    const id = state.targets.push({ lat: p.lat, lon: p.lon, name, radius: 120 }) - 1;
    const away = state.me ? ' · ' + fmtDist(dist(state.me.lat, state.me.lon, p.lat, p.lon)) + ' away' : '';
    return `<li data-act="show" data-t="${id}"><div class="ico">${p.meet ? '📣' : '🙋'}</div><div class="main"><div class="t">${esc(name)}</div><div class="s">${ago(p.t)}${away}${p.label && !p.meet ? ' · ' + esc(p.label) : ''}</div></div>
      <button class="btn small" data-act="route" data-t="${id}">🧭</button> <button class="btn small light" data-act="del-pin" data-name="${esc(name)}">✕</button></li>`;
  }).join('');
  showSheet('The lads', `
    <button class="btn pink block" data-act="share-me">📍 Share my location with the group</button>
    <p class="note">Sends a link to your group chat. When the others tap it, you appear on their map and they can get a route to you. Long-press the map or tap a hut and choose “Meet here” to set a meeting point.</p>
    ${items ? `<h3>Shared locations</h3><ul class="list">${items}</ul>` : '<p class="note">No one has shared a location yet.</p>'}`);
}

// ---------------------------------------------------------------- settings / info
function renderLevelPill() {
  const a = ABILITY.find((x) => x.v === settings.level) || ABILITY[1];
  $('#level-pill').innerHTML = a.dots.map((l) => `<span class="dot" style="background:${LEVELS[l].color}"></span>`).join('') + ' ' + a.label;
}
function openSettings() {
  const d = state.data;
  showSheet('Settings', `
    <label class="field">Your name (for sharing)</label>
    <input class="text" id="set-name" value="${esc(settings.name)}" placeholder="e.g. Dave" maxlength="20">
    <label class="field">Group level – which runs can routes use?</label>
    <div class="seg">${ABILITY.map((a) => `<button data-act="level" data-v="${a.v}" class="${a.v === settings.level ? 'on' : ''}">${a.dots.map((l) => `<span class="dot" style="background:${LEVELS[l].color}"></span>`).join('')} ${a.label}</button>`).join('')}</div>
    <p class="note">Set this to the weakest skier in the group. Runs above it are faded on the map.</p>
    <label class="field">Background map</label>
    <div class="seg"><button data-act="base" data-v="topo" class="${settings.base === 'topo' ? 'on' : ''}">⛰️ Topo (contours)</button><button data-act="base" data-v="osm" class="${settings.base === 'osm' ? 'on' : ''}">🗺️ Street map</button></div>
    <label class="field">Piste data</label>
    <p class="note">${d ? `${d.pistes.length} piste sections, ${d.lifts.length} lifts, ${d.pois.length} places · downloaded ${new Date(d.t).toLocaleDateString()}` : 'Not downloaded yet'}</p>
    <button class="btn light block" data-act="refresh">🔄 Re-download piste data</button>
    <p class="note">Before the trip: open the app on Wi-Fi and pan/zoom around the whole ski area so the map tiles are saved for offline use. On iPhone use Share → “Add to Home Screen”, on Android ⋮ → “Install app”.</p>`);
  $('#set-name').addEventListener('change', (e) => { settings.name = e.target.value.trim(); saveLS('skinav-settings', settings); });
}
function openInfo() {
  showSheet('Legend, tips & emergency', `
    <div class="legend">
      <div><span class="sw" style="background:${LEVELS[1].color}"></span>Blue – easy</div>
      <div><span class="sw" style="background:${LEVELS[2].color}"></span>Red – intermediate</div>
      <div><span class="sw" style="background:${LEVELS[3].color}"></span>Black – difficult</div>
      <div><span class="sw" style="background:repeating-linear-gradient(90deg,${LEVELS[4].color} 0 8px,transparent 8px 13px)"></span>Ski route (ungroomed, not patrolled like pistes)</div>
      <div><span class="sw" style="background:#2b2b2b"></span>Lift (dashed = drag lift)</div>
      <div><span class="sw" style="background:repeating-linear-gradient(90deg,#7a5af8 0 10px,transparent 10px 15px)"></span>Your route – lift</div>
      <div>🍴 hut/restaurant &nbsp; 🍺 bar &nbsp; 🚻 toilets &nbsp; 🚡 station</div>
    </div>
    <h3>🚨 Emergency</h3>
    <div class="tel"><span>Mountain rescue Austria (Ischgl side)</span><a href="tel:140">140</a></div>
    <div class="tel"><span>European emergency number</span><a href="tel:112">112</a></div>
    <div class="tel"><span>Rega air rescue (Swiss / Samnaun side)</span><a href="tel:1414">1414</a></div>
    <div class="tel"><span>Ambulance Switzerland</span><a href="tel:144">144</a></div>
    <p class="note">Tell them: resort Ischgl/Samnaun, the run number or lift nearest you, and send your location (👥 → Share my location gives coordinates).</p>
    <h3>💡 Tips for the lads</h3>
    <ul class="note">
      <li>The ski area spans Austria (Ischgl) and Switzerland (Samnaun). Samnaun is duty-free – but leave plenty of time to get back over before the lifts close, or it’s a very expensive taxi.</li>
      <li>Pick a meeting point + time every morning (👥 → Meet here) in case anyone gets separated or their phone dies.</li>
      <li>Phone batteries die fast in the cold – keep your phone in an inside pocket and bring a power bank.</li>
      <li>Lift and piste closures change daily – check the boards at the stations or the official Ischgl app/website.</li>
      <li>Got roaming? Check your plan: the Swiss side is outside the EU, so data may cost extra.</li>
    </ul>
    <p class="note">Piste &amp; lift data © OpenStreetMap contributors. Not an official resort map – always follow signs and closures on the mountain.</p>`);
}

// ---------------------------------------------------------------- global click handling
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, t = el.dataset.t != null ? state.targets[+el.dataset.t] : null;
  e.stopPropagation();
  switch (act) {
    case 'route': routeTo(t); break;
    case 'show': map.setView([t.lat, t.lon], 16); {
      const id = state.targets.push(t) - 1;
      showSheet(t.name, `<div class="row"><button class="btn" data-act="route" data-t="${id}">🧭 Route here</button><button class="btn light" data-act="meet" data-t="${id}">📣 Meet here</button></div>`);
    } break;
    case 'meet': map.closePopup(); shareMeetPoint(t); break;
    case 'from': state.routeFrom = { lat: t.lat, lon: t.lon, name: 'chosen start' }; map.closePopup();
      toast('Start set – now pick where to go'); if (state.lastRouteTarget) routeTo(state.lastRouteTarget); break;
    case 'from-gps': state.routeFrom = null; if (state.lastRouteTarget) routeTo(state.lastRouteTarget); break;
    case 'clear-route': layers.route.clearLayers(); state.lastRouteTarget = null; state.routeFrom = null; hideSheet(); break;
    case 'step': {
      const s = state.routeSteps && state.routeSteps[+el.dataset.i];
      if (s) { map.fitBounds(L.latLngBounds(s.pts), { maxZoom: 16, paddingBottomRight: [20, window.innerHeight * 0.45] }); $('#sheet').classList.add('mini'); }
    } break;
    case 'home-ischgl': $('#search').blur(); routeTo(homePlace(/^ischgl$/i, FALLBACK_PLACES.ischgl)); break;
    case 'home-samnaun': $('#search').blur(); routeTo(homePlace(/ravaisch|samnaun/i, FALLBACK_PLACES.samnaun)); break;
    case 'start-ischgl': { const h = homePlace(/^ischgl$/i, FALLBACK_PLACES.ischgl); state.routeFrom = { lat: h.lat, lon: h.lon, name: h.name }; state.pickingStart = null; routeTo(state.lastRouteTarget); } break;
    case 'near-food': case 'near-bar': case 'near-wc': {
      const kinds = act === 'near-food' ? ['food'] : act === 'near-bar' ? ['bar'] : ['wc'];
      const p = nearestPoi(kinds); $('#search').blur();
      if (p) routeTo({ lat: p.lat, lon: p.lon, name: p.n, radius: 150 }); else toast('None found on the map');
    } break;
    case 'share-me': shareMyLocation(); break;
    case 'del-pin': delete pins[el.dataset.name]; saveLS('skinav-pins', pins); drawFriends(); openGroup(); break;
    case 'level': settings.level = +el.dataset.v; saveLS('skinav-settings', settings); restylePistes(); openSettings(); break;
    case 'base': setBase(el.dataset.v); openSettings(); break;
    case 'refresh': refreshData(true); break;
    case 'retry': hideSheet(); refreshData(true); break;
  }
}, true); // capture phase: Leaflet popups stop click propagation
$('#btn-settings').addEventListener('click', openSettings);
$('#btn-info').addEventListener('click', openInfo);
$('#btn-group').addEventListener('click', openGroup);
$('#btn-home').addEventListener('click', () => {
  // closest of Ischgl / Samnaun? Home = Ischgl (where the hotel is) unless you're in Samnaun valley
  routeTo(homePlace(/^ischgl$/i, FALLBACK_PLACES.ischgl));
});
$('#level-pill').addEventListener('click', () => {
  settings.level = settings.level >= 4 ? 1 : settings.level + 1; saveLS('skinav-settings', settings);
  restylePistes(); toast('Routes now use: ' + ABILITY.find((a) => a.v === settings.level).label);
  if (state.lastRouteTarget && !$('#sheet').classList.contains('hidden')) routeTo(state.lastRouteTarget, { quiet: true });
});

// ---------------------------------------------------------------- boot
(async function boot() {
  renderLevelPill();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  startGps();
  const cached = await loadData();
  if (cached && cached.v === DATA_VERSION && cached.pistes && cached.pistes.length) {
    useData(cached);
    if (Date.now() - cached.t > DATA_MAX_AGE && navigator.onLine) refreshData(false);
  } else {
    await refreshData(true);
  }
  readHashPin();
})();

// exposed for testing
window.__skinav = { state, settings, findRoute, buildSteps, processOverpass, map };
