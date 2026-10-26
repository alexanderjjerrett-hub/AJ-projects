# PdS Mountain Guide: prototype

A dependency-free web prototype of the Portes du Soleil guide app (see [`../docs/DESIGN.md`](../docs/DESIGN.md)).

It's a full-screen **3D terrain map** (tilt with two fingers or right-drag, and switch to 2D with one tap). It finds the nearest restaurants, bars, toilets, shops, cash machines and first aid **that you can actually reach**, given:

- how you're getting around (ski / snowboard / on foot)
- your ability (green → black runs)
- where you are (pick a place, or tap 📍 to use GPS)
- the time (lifts and shuttle buses close, and the app knows it)

Results show as numbered pins. The selected route is drawn on the mountain in piste colours, and the camera flies to it. Tap any village or lift station on the map to start from there. The 🗺️ button switches between satellite, topographic and terrain-only backgrounds, and can add a real piste-map overlay (OpenSnowMap).

## Run it

```bash
cd prototype
npm start          # serves on http://localhost:8080
npm test           # routing, search and query-parser tests (Node 20+)
```

It needs a connection for map tiles: elevation from AWS Terrain Tiles, plus Esri satellite or OpenTopoMap imagery. If the imagery can't load, it falls back to terrain-only shading automatically. The map library (MapLibre GL JS 5.24.0) is bundled in `vendor/`, so no CDN is needed.

### Hosted copy

A copy is published as a private claude.ai page, so it opens in any browser without running anything. Hosted pages can't load map tiles from other sites, so that copy carries its own **terrain pack** (elevation tiles for the area) and shows the terrain-only background. To rebuild it:

```bash
npm run build:terrain    # downloads ~26 MB of elevation tiles into dist/artifact/terrain
npm run build:artifact   # writes dist/artifact/index.html with the CSS and JS inlined
```

Try typing:

- `cheap lunch near Les Gets, beginner with kids`
- `après drinks in Avoriaz, I'm not skiing`
- `need a loo at Super Morzine`
- `my binding broke, snowboarder on reds`

## Layout

| File | Purpose |
|---|---|
| `src/data.js` | **Sample** graph: villages, lift stations, pistes, lifts, shuttles and POIs for Morzine, Les Gets and Avoriaz |
| `src/routing.js` | Ability-aware, time-dependent shortest paths (Dijkstra) |
| `src/search.js` | Ranks POIs by travel time and preferences, and warns about closing times and missing the last lift home |
| `src/query.js` | Plain-language "occasion" parser |
| `src/locate.js` | GPS → nearest graph node |
| `src/terrain-pack.js` | Serves 3D terrain from a bundled terrain pack instead of a tile server |
| `src/geometry.js` | Turns the graph and routes into map lines (GeoJSON) |
| `src/app.js` | 3D map (MapLibre GL JS), search panel and results |
| `vendor/maplibre-gl/` | Bundled MapLibre GL JS 5.24.0 (BSD-3-Clause) |

> ⚠️ The data is illustrative. Locations are approximate (altitudes checked against the elevation model), times are made up, and venue names are generic. Pistes are drawn as curves between places rather than their true paths; real OpenStreetMap geometry replaces them in the MVP. It is not for navigation.
