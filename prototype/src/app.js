import * as data from './data.js';
import { toMinutes, toClock } from './routing.js';
import { search } from './search.js';
import { parseQuery } from './query.js';
import { nearestNode } from './locate.js';

const graph = { nodes: data.nodes, edges: data.edges, pois: data.pois };
const $ = (sel) => document.querySelector(sel);
const CATEGORY_LABEL = { restaurant: 'places to eat', bar: 'bars', toilet: 'toilets', shop: 'shops', atm: 'cash machines', firstaid: 'first aid' };
const MODE_LABEL = { ski: 'skiing', snowboard: 'snowboarding', walk: 'on foot' };

let lastSearch = null;

// ---------- controls ----------

for (const n of data.nodes) $('#origin').add(new Option(n.name, n.id));

const now = new Date();
const nowMinutes = now.getHours() * 60 + now.getMinutes();
if (nowMinutes >= toMinutes('08:00') && nowMinutes <= toMinutes('20:00')) $('#time').value = toClock(nowMinutes);

function profile() {
  const mode = document.querySelector('input[name=mode]:checked').value;
  return { mode, maxLevel: mode === 'walk' ? 0 : Number($('#level').value) };
}

function syncAbilityRow() {
  $('#ability-row').hidden = profile().mode === 'walk';
}

document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { syncAbilityRow(); rerun(); }));
['#level', '#origin', '#time'].forEach((s) => $(s).addEventListener('change', rerun));

$('#gps').addEventListener('click', () => {
  const status = $('#gps-status');
  status.hidden = false;
  if (!navigator.geolocation) {
    status.textContent = 'Location is not available on this device. Choose where you are from the list.';
    return;
  }
  status.textContent = 'Finding you…';
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const hit = nearestNode(data.nodes, { lat: coords.latitude, lon: coords.longitude });
      if (!hit) {
        status.textContent = 'You seem to be outside the mapped area (Morzine, Les Gets, Avoriaz). Choose a start point from the list.';
        return;
      }
      $('#origin').value = hit.node.id;
      status.textContent = `Nearest point: ${hit.node.name} (${Math.round(hit.distance)} m away).`;
      rerun();
    },
    () => { status.textContent = 'Could not get your location. Choose where you are from the list.'; },
    { enableHighAccuracy: true, timeout: 10000 },
  );
});

document.querySelectorAll('.quick button').forEach((b) => b.addEventListener('click', () => {
  $('#understood').hidden = true;
  run({
    category: b.dataset.category,
    subtype: b.dataset.subtype || undefined,
    tags: b.dataset.tags ? b.dataset.tags.split(',') : [],
  });
}));

$('#ask').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const text = $('#q').value.trim();
  if (!text) return;
  const parsed = parseQuery(text, data.nodes);

  // The query can override the profile and start point.
  if (parsed.mode) document.querySelector(`input[name=mode][value=${parsed.mode}]`).checked = true;
  if (parsed.maxLevel) $('#level').value = String(parsed.maxLevel);
  if (parsed.place) $('#origin').value = parsed.place;
  syncAbilityRow();

  const understood = $('#understood');
  understood.hidden = false;
  if (!parsed.category) {
    understood.textContent = 'Sorry, I didn’t catch what you’re looking for. Try “lunch”, “toilets”, “après” or “hire shop”, or tap a button.';
    $('#results').replaceChildren();
    return;
  }
  const what = parsed.subtype === 'rental' ? 'hire & repair shops' : parsed.subtype ? `${parsed.subtype}s` : CATEGORY_LABEL[parsed.category];
  const bits = [what];
  if (parsed.tags.length) bits.push(`preferring ${parsed.tags.join(', ')}`);
  bits.push(`from ${$('#origin').selectedOptions[0].text}`);
  bits.push(profile().mode === 'walk' ? 'on foot' : `${MODE_LABEL[profile().mode]}, up to ${data.LEVEL_NAMES[profile().maxLevel]} runs`);
  understood.textContent = `Looking for ${bits.join(' · ')}`;

  run({ category: parsed.category, subtype: parsed.subtype, tags: parsed.tags });
});

function rerun() {
  if (lastSearch) run(lastSearch);
  else drawMap([]);
}

// ---------- search & results ----------

function run(criteria) {
  lastSearch = criteria;
  const results = search(graph, {
    ...criteria,
    origin: $('#origin').value,
    profile: profile(),
    depart: toMinutes($('#time').value || '11:30'),
  });
  renderResults(results);
  drawMap(results[0]?.route.path ?? [], results[0]?.poi.node);
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...children.filter((c) => c !== null && c !== undefined));
  return e;
}

function renderResults(results) {
  const list = $('#results');
  if (!results.length) {
    list.replaceChildren(el('li', { class: 'empty' }, 'Nothing open that you can reach from here at that time. Try a different start point, an earlier time, or a higher ability level.'));
    return;
  }
  list.replaceChildren(...results.map((r, i) => {
    const node = data.nodes.find((n) => n.id === r.poi.node);
    const eta = r.minutes === 0 ? 'Here' : `${r.minutes} min`;
    const chips = el('div', { class: 'chips' },
      r.route.hardest ? el('span', { class: `chip lvl ${r.route.hardest}` }, `hardest: ${r.route.hardest}`) : null,
      ...r.poi.tags.map((t) => el('span', { class: 'chip' }, t)),
      ...r.missingTags.map((t) => el('span', { class: 'chip miss', title: 'Doesn’t match this preference' }, t)),
      r.poi.price ? el('span', { class: 'chip' }, '€'.repeat(r.poi.price)) : null,
    );
    const steps = r.route.steps.length
      ? el('details', {}, el('summary', {}, `Route (${r.route.steps.length} step${r.route.steps.length > 1 ? 's' : ''})`),
        el('ol', { class: 'steps' }, ...r.route.steps.map((s) => el('li', {}, el('time', {}, s.depart), s.text))))
      : null;
    const li = el('li', { class: `result${i === 0 ? ' selected' : ''}`, tabindex: '0' },
      el('header', {}, el('h3', {}, r.poi.name), el('span', { class: 'eta' }, eta)),
      el('div', { class: 'meta' }, `${node.name} · arrive ${r.arrival} · open ${r.poi.open}–${r.poi.close}`),
      chips,
      ...r.warnings.map((w) => el('div', { class: 'warn' }, `⚠️ ${w}`)),
      steps,
    );
    const select = () => {
      list.querySelectorAll('.result').forEach((x) => x.classList.remove('selected'));
      li.classList.add('selected');
      drawMap(r.route.path, r.poi.node);
    };
    li.addEventListener('click', select);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') select(); });
    return li;
  }));
}

// ---------- schematic map ----------

const SVG_NS = 'http://www.w3.org/2000/svg';
const lons = data.nodes.map((n) => n.lon);
const lats = data.nodes.map((n) => n.lat);
const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
const project = (n) => ({
  x: 30 + ((n.lon - minLon) / (maxLon - minLon)) * 300,
  y: 25 + ((maxLat - n.lat) / (maxLat - minLat)) * 210,
});

function svg(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function drawMap(path = [], destination = null) {
  const map = $('#map');
  map.replaceChildren();
  const used = new Set(path.map((s) => s.edge.id));
  const origin = $('#origin').value;
  const pairCount = new Map();

  for (const e of data.edges) {
    const a = project(data.nodes.find((n) => n.id === e.from));
    const b = project(data.nodes.find((n) => n.id === e.to));
    // Bend parallel edges between the same two places so they don't overlap.
    const key = [e.from, e.to].sort().join('|');
    const k = pairCount.get(key) ?? 0;
    pairCount.set(key, k + 1);
    const bend = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 14;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const cx = (a.x + b.x) / 2 + (-(b.y - a.y) / len) * bend;
    const cy = (a.y + b.y) / 2 + ((b.x - a.x) / len) * bend;
    const cls = e.type === 'piste' ? `l${e.level}` : e.type;
    const p = svg('path', { d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`, class: `edge ${cls}${used.has(e.id) ? ' on' : ''}` });
    p.append(svg('title', {}));
    p.firstChild.textContent = e.name;
    map.append(p);
  }

  for (const n of data.nodes) {
    const { x, y } = project(n);
    const cls = n.id === origin ? 'origin' : n.id === destination ? 'dest' : '';
    map.append(svg('circle', { cx: x, cy: y, r: n.kind === 'village' ? 6 : 4, class: cls }));
    const label = svg('text', { x: x + 8, y: y + 3 });
    label.textContent = n.name.replace(/\s*\(.*\)/, '');
    map.append(label);
  }
}

syncAbilityRow();
drawMap();
