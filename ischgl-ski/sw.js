/* Offline support: app shell + map tiles you have viewed are kept on the phone. */
const SHELL_CACHE = 'skinav-shell-v1';
const TILE_CACHE = 'skinav-tiles';
const MAX_TILES = 4000;
const SHELL = ['./', './index.html', './app.js', './style.css', './vendor/leaflet.js', './vendor/leaflet.css',
  './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'];
const TILE_HOSTS = /(^|\.)tile\.opentopomap\.org$|^tile\.openstreetmap\.org$/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((k) => k.startsWith('skinav-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

let puts = 0;
async function trimTiles() {
  const c = await caches.open(TILE_CACHE);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (TILE_HOSTS.test(url.hostname)) {
    e.respondWith(caches.open(TILE_CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { c.put(req, res.clone()); if (++puts % 200 === 0) trimTiles(); }
      return res;
    }));
    return;
  }
  if (url.origin === self.location.origin) {
    // stale-while-revalidate for the app itself
    e.respondWith(caches.open(SHELL_CACHE).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
