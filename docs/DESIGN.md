# Portes du Soleil Guide: Product & Technical Design

**Status:** Draft v0.1 · **Season focus:** Winter (ski season) · **Region:** Portes du Soleil (France & Switzerland)

---

## 1. Vision

A pocket tour guide for everyone in the Portes du Soleil, whether they're skiing, snowboarding or walking round the villages. It answers one question:

> "Where's the nearest **X** that **I** can actually get to from **here**?"

**X** can be a restaurant, bar, toilet, shop, ATM, pharmacy, hire shop or first-aid point. **I** means the user's ability and how they're getting around. **Here** is a place they choose at first and, later, their GPS position.

What makes it different from a generic map app is **ability-aware routing**. A nervous green-run skier should never be sent down a black run to reach a "nearby" restaurant, and someone in snow boots should only be sent along footpaths, shuttle buses and pedestrian-friendly lifts.

## 2. Users

| Persona | Getting around | Typical needs | Key constraint |
|---|---|---|---|
| **Beginner skier** (adult or child) | Skis, green runs and easy blues | Toilets, a warm lunch spot, the way back to the village | Must never be routed onto runs above their level |
| **Confident skier or snowboarder** | Any piste | Lunch with a view, après bar, ski across the area | Lift closing times, distance to the next valley |
| **Snowboarder** | Board | As above | Avoid drag lifts and long flat runs where possible |
| **Non-skier / pedestrian** | On foot, buses, pedestrian lifts | Meet the skiers for lunch, shops, cafés, pharmacy | Only lifts that carry foot passengers, plus shuttles and footpaths |
| **Mixed group / family** | Mixed | One place everyone can reach | Route for the *weakest* member; places that suit both skiers and walkers |

## 3. Core user journeys

1. **"I need a loo, now."** One tap → nearest reachable toilets with a route and time.
2. **"Lunch at 12:30 near Avoriaz, I'm on blues."** → Restaurants ranked by travel time, showing only routes on green/blue runs.
3. **"Where can I meet my family who aren't skiing?"** → Places reachable by *both* profiles (walker + skier), e.g. a summit restaurant served by a pedestrian gondola.
4. **"Après-ski, then get home to Morzine."** → Bars, with a warning if the last lift or bus home closes first.
5. **"My binding broke."** → Nearest hire or repair shop that's open.

## 4. Feature set

### 4.1 MVP: "Ask" mode (no GPS)
- **Profile setup** (asked once, can be changed any time):
  - Mode: Ski / Snowboard / On foot
  - Ability: Beginner (green) · Intermediate (blue) · Confident (red) · Expert (black)
  - Options: avoid drag lifts, family-friendly, budget
- **Occasion search**, in two ways:
  - *Quick buttons:* Lunch on the slopes · Après-ski · Toilets · Shops · Hire/repair · Pharmacy/first aid · ATM
  - *Plain-language query:* e.g. "cheap lunch near Les Gets for a beginner with kids"
- **Starting point:** pick a village or lift station (later replaced by GPS).
- **Results:** ranked by travel time. Each result shows a step-by-step route (lift → piste → walk), the hardest run on the route, opening hours, and tags (terrace, kids, self-service, price).
- **Safety and timing warnings:** last lift/bus times, routes that cross into Switzerland (CHF, different piste grading), and routes at the top of the user's ability.

### 4.2 Phase 2: GPS
- Snap the GPS position to the nearest point on the graph (lift station, piste segment or village path).
- "Nearest X from where I'm standing", with live re-routing.
- Offline maps and offline routing, because mobile signal on the mountain is unreliable.
- Battery-aware location (high accuracy only while navigating).
- Optional "find my group" (opt-in location sharing).

### 4.3 Phase 3: Live data and personalisation
- Live lift and piste open/closed status, plus grooming reports, from resort feeds.
- Weather, wind closures and visibility. Prefer lower or sheltered routes in bad weather.
- Restaurant table booking, menus and live queue times (partners).
- Summer mode: hiking and MTB using the same engine with different edge types.

## 5. Ability-aware routing (the core engine)

The ski area is modelled as a **directed graph**:

- **Nodes:** villages, lift stations, piste junctions, bus stops.
- **Edges**, each with a type:
  - `piste`: downhill only. Carries a difficulty (green/blue/red/black), length and a `flat` flag.
  - `lift`: uphill. Carries a lift type (gondola, chair, drag, cable car), ride time, average wait, opening hours, `pedestrian` (foot passengers allowed) and `download` (can ride it back down).
  - `walk`: footpaths and village streets, in both directions.
  - `bus`: resort shuttles. Carry a timetable or frequency and hours.
- **Points of interest** are attached to a node.

**Filtering by profile (hard rules):**

| Profile | Allowed edges |
|---|---|
| Ski / Snowboard, ability *n* | Pistes with difficulty ≤ *n*, all lifts, walk and bus edges, and download rides where allowed |
| Snowboard + avoid drags | As above, but drag lifts are excluded (or heavily penalised if they're the only option) |
| On foot | Walk and bus edges, plus lifts where `pedestrian = true` (up, and down where allowed) |

**Cost function:** estimated time in minutes.
- Piste time = length ÷ speed, where speed depends on the user's ability. A run at the user's maximum level is taken more slowly.
- Lift time = ride time + typical wait.
- Bus time = journey time + average wait.
- Small penalties are added for things users dislike, such as flat runs for snowboarders and walking in ski boots.

**Time-dependent search:** Dijkstra's algorithm, tracking clock time. An edge that is closed when you'd reach it (lift shut, last bus gone) can't be used. This gives "last lift" handling for free and stops the app recommending an après bar you can't get home from.

**Grading note:** French resorts use green/blue/red/black. Swiss resorts have no green, so their blue covers a wider range. The engine stores one internal 1–4 scale per piste, and the data team records the *local* colour alongside it for display.

**Groups:** a group route is the intersection of the members' allowed edges. In practice, it's routed for the most restrictive member.

## 6. Plain-language "occasion" queries

MVP: a lightweight rule-based parser, which is deterministic, works offline and is easy to test. It extracts:
- **Category**, e.g. lunch/eat → restaurant; loo/WC → toilet; après/drink → bar; hire/rental → shop:rental.
- **Ability**, e.g. "beginner", "blue", "red runs", "expert".
- **Mode**, e.g. "walking", "not skiing", "snowboard".
- **Place**, e.g. "near Avoriaz", "from Les Gets" (with aliases and accent-insensitive matching).
- **Preferences**, e.g. kids/family, cheap/budget, terrace/sunny, live music.

Later: an LLM layer can turn messy multilingual queries (EN/FR/DE/NL, the main visitor languages) into the same structured search. The routing itself stays deterministic. The model never makes up routes or venues.

## 7. Data

| Data | Source options | Notes |
|---|---|---|
| Pistes, lifts, topology | OpenStreetMap (`piste:type`, `piste:difficulty`, `aerialway=*`), resort piste maps | OSM coverage in PdS is good but needs checking. Junctions need manual curation |
| Lift hours and live status | Portes du Soleil / individual resort feeds (partnership needed) | Hours change through the season |
| POIs | OSM (`amenity=restaurant/bar/toilets/pharmacy/atm`), resort guides, direct sign-up by businesses | Opening hours, terrace, kids, price band, accessible from piste/village |
| Buses | Resort shuttle timetables (Morzine–Les Gets, Morzine–Prodains, etc.) | Seasonal |
| Elevation | SRTM / Copernicus DEM | Piste gradient, walking effort |

There are 12 resorts across two countries (Avoriaz, Châtel, Morzine, Les Gets, Saint-Jean-d'Aulps, Abondance, La Chapelle d'Abondance, Montriond, Champéry, Morgins, Torgon, Val d'Illiez–Les Crosets–Champoussin). **Rollout plan:** start with Morzine, Les Gets and Avoriaz, which have the densest visitor population, then extend across the linked area.

## 8. Architecture

```
┌─────────────────────────┐        ┌─────────────────────────────┐
│ Mobile app (PWA → native)│        │ Backend                      │
│  • Profile & search UI   │  sync  │  • Graph builder (OSM → JSON)│
│  • Map (vector tiles)    │◄──────►│  • POI admin / partner portal│
│  • On-device routing     │        │  • Live lift/weather ingest  │
│  • Offline data pack     │        │  • Analytics (anonymised)    │
│  • GPS → graph snapping  │        └─────────────────────────────┘
└─────────────────────────┘
```

- **Routing runs on the device.** The graph for the whole area is small (thousands of edges), so it works offline and responds instantly. The server only distributes updated data packs and live status.
- **Prototype:** a dependency-free web app (`/prototype`) that proves the engine and the query parser.
- **Production candidates:** React Native or Flutter for iOS and Android, MapLibre with offline vector tiles, and SQLite for the data pack.

## 9. Safety, privacy and liability

- Clear disclaimers: piste conditions change, so follow resort signage and ski patrol. The app is guidance only.
- Never route through closed pistes or lifts once live status exists. Until then, flag that status is not live.
- Emergency button: local emergency numbers (112, and 144 in Switzerland) and the resort piste rescue number, with the GPS coordinates ready to read out.
- Location stays on the device by default. Group sharing is opt-in and expires. GDPR compliant.

## 10. Success measures

- Time from opening the app to getting an answer (target: under 10 seconds for "nearest toilet").
- Percentage of routes that match the user's ability (target: 100%, enforced by tests).
- Weekly active users per resort over the season, and how many come back.
- Partner (venue) sign-ups and referral bookings, as a future revenue stream.

## 11. Roadmap

| Phase | Scope |
|---|---|
| **0: Prototype** (this repo) | Sample graph for Morzine, Les Gets and Avoriaz; routing engine; query parser; web UI; "use my location" snapping |
| **1: MVP** | Real OSM-derived graph for the three core resorts; verified POIs; iOS/Android beta; FR/EN |
| **2: GPS & offline** | Live positioning, offline packs, re-routing, whole linked area |
| **3: Live & partners** | Lift status feeds, weather, bookings, group finder, DE/NL |
| **4: Summer** | Hiking, MTB and lift-served bike park routing |

## 12. Open questions

1. Data partnerships: can we get official lift-status and piste-map data from the Portes du Soleil association or individual resorts?
2. Business model: free with venue partnerships, a premium tier (offline, group finder), or white-label for the resorts?
3. Which languages at launch? (UK and Dutch visitors are a large share in Morzine and Les Gets.)
4. How should the app handle off-piste requests? Recommendation: never route off-piste.
