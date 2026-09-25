# Syros — Queen of the Cyclades

A single-page static website celebrating the Greek island of Syros: Ermoupoli and
Ano Syros, favourite places, an interactive beach map, a short history, local food,
and travel tips.

## View it

No build step. Open `syros/index.html` in a browser, or serve the folder:

```sh
cd syros && python3 -m http.server 8000   # then visit http://localhost:8000
```

It also works as-is on GitHub Pages.

## Files

- `index.html` — page content
- `styles.css` — styles (responsive, respects reduced-motion)
- `script.js` — mobile menu, scroll reveals, beach map, seasons tabs
- `images/*.svg` — original illustrations
- `tools/generate_illustrations.py` — regenerates the illustrations (`python3 syros/tools/generate_illustrations.py`)

## Using real photos

The illustrations are placeholders you can swap for photographs: drop a photo into
`images/` and change the matching `src` in `index.html` (e.g. `images/kini.svg` →
`images/kini.jpg`). Update the `alt` text to describe the photo. Only use photos you
took yourself or that are licensed for reuse, and credit them in the footer.
