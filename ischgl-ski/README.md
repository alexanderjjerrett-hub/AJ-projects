# Ischgl Ski Nav 🎿

A phone web app for finding your way around the **Ischgl / Samnaun (Silvretta Arena)** ski area. Nobody in the group needs to know the mountain.

## What it does
- **Live piste map**: blue, red and black runs, ski routes, every lift, huts and bars, with your GPS position as a blue dot.
- **Turn-by-turn routes** that use lifts and runs. For example: "Take the X gondola up → Run 4 (blue) → Take Y chairlift…", with a rough time and arrival estimate.
  - **Group level** (top-left pill): blues only, blue and red, up to black, or everything. Set it to the weakest skier and routes avoid anything harder. Harder runs fade on the map.
  - 🏠 **Take me home** routes you back to Ischgl village. Search has quick buttons for Samnaun, the nearest hut, the nearest bar and the nearest toilets.
  - Tap a run, lift or hut (or long-press anywhere) and choose **Route here**.
- **The lads (👥)**:
  - *Share my location* sends a link to the group chat. Tapping it shows you on their map, with a route to you.
  - *Meet here* sends a meeting point, with a time, to the group.
- **Emergency numbers** for the Austrian and Swiss sides (ℹ️), plus a legend and tips.
- **Works offline** once it has loaded. The piste data is saved on the phone, and so is every map area you've looked at.

Piste and lift data come from [OpenStreetMap](https://www.openstreetmap.org/copyright) through the Overpass API. This is **not an official resort map**: always follow the signs and closures on the mountain.

## Getting it on everyone's phone
The app has to be served over HTTPS (needed for GPS and offline mode). The easiest free option is GitHub Pages:
1. Merge this branch into `main`.
2. In the GitHub repo, go to **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
3. After a minute the app is live at `https://<your-github-username>.github.io/AJ-projects/ischgl-ski/`. Send that link to the lads.
4. Each person opens it and adds it to their home screen:
   - **iPhone (Safari):** Share → *Add to Home Screen*
   - **Android (Chrome):** ⋮ → *Install app*

## Before the trip (on Wi-Fi)
- Open the app once so it downloads the piste data (takes a few seconds).
- Pan and zoom around the whole ski area (Ischgl ↔ Idalp ↔ Samnaun) so the map tiles are saved for offline use.
- Set your name and the group level under ⚙️.

## Files
| File | Purpose |
|---|---|
| `index.html`, `style.css` | App shell / layout |
| `app.js` | Data download + caching, routing graph and Dijkstra, map drawing, sharing |
| `sw.js` | Service worker for offline use (app and map tiles) |
| `vendor/` | Leaflet 1.9.4 (map library) |
