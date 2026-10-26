# PdS Mountain Guide: prototype

A dependency-free web prototype of the Portes du Soleil guide app (see [`../docs/DESIGN.md`](../docs/DESIGN.md)).

It finds the nearest restaurants, bars, toilets, shops, cash machines and first aid **that you can actually reach**, given:

- how you're getting around (ski / snowboard / on foot)
- your ability (green → black runs)
- where you are (pick a place, or tap 📍 to use GPS)
- the time (lifts and shuttle buses close, and the app knows it)

## Run it

```bash
cd prototype
npm start          # serves on http://localhost:8080
npm test           # routing, search and query-parser tests (Node 20+)
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
| `src/app.js` | UI and schematic map |

> ⚠️ The data is illustrative. Locations are approximate, times are made up, and venue names are generic. It is not for navigation.
