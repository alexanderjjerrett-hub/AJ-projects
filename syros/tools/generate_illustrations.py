#!/usr/bin/env python3
"""Generate the Cycladic-style SVG illustrations used by the Syros site.

Run from anywhere:  python3 syros/tools/generate_illustrations.py
Output goes to syros/images/. Randomness is seeded, so output is stable.
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "images"

WHITE = "#fbfaf6"
SHADE = "#e2ded3"
WINDOW = "#23456b"
BLUE_DOME = "#1f5fa8"
PASTELS = ["#f3e1b6", "#e8b48a", "#f0cfc0", "#e9d7a6", "#f6ead2", "#dfb17c", "#ecc3a8"]
ROOF = "#b8573e"


def svg(w, h, body, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'role="img" aria-label="{title}">\n<title>{title}</title>\n{body}\n</svg>\n'
    )


def grad(gid, stops, vertical=True):
    coords = 'x1="0" y1="0" x2="0" y2="1"' if vertical else 'x1="0" y1="0" x2="1" y2="0"'
    s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{gid}" {coords}>{s}</linearGradient>'


def hill_fn(c, peak, w, base):
    return lambda x: base - (base - peak) * math.exp(-(((x - c) / w) ** 2))


def hill_path(fn, x0, x1, bottom, step=8):
    pts = [f"{x:.1f},{fn(x):.1f}" for x in range(int(x0), int(x1) + 1, step)]
    return f"M{x0},{bottom} L" + " L".join(pts) + f" L{x1},{bottom} Z"


def ridge_path(points, bottom, w):
    return f"M0,{bottom} L" + " L".join(f"{x},{y}" for x, y in points) + f" L{w},{bottom} Z"


def cube(x, y, w, h, rnd, color=WHITE, shade=SHADE, windows=True):
    """A flat-roofed Cycladic house whose top-left corner is (x, y)."""
    side = max(3, w * 0.22)
    parts = [
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{color}"/>',
        f'<rect x="{x + w - side:.1f}" y="{y:.1f}" width="{side:.1f}" height="{h:.1f}" fill="{shade}"/>',
    ]
    if windows and w > 9 and h > 9:
        for _ in range(rnd.randint(1, 2)):
            ww, wh = max(2, w * 0.14), max(3, h * 0.28)
            wx = x + rnd.uniform(2, max(2.1, w - side - ww - 1))
            wy = y + rnd.uniform(h * 0.2, h * 0.55)
            fill = BLUE_DOME if rnd.random() < 0.35 else WINDOW
            parts.append(f'<rect x="{wx:.1f}" y="{wy:.1f}" width="{ww:.1f}" height="{wh:.1f}" fill="{fill}"/>')
    return "".join(parts)


def mansion(x, y, w, h, rnd, roof=True):
    """A pastel neoclassical Ermoupoli house with tiled roof and tall windows."""
    color = rnd.choice(PASTELS)
    parts = [f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{color}"/>']
    if roof:
        parts.append(
            f'<polygon points="{x - 2:.1f},{y:.1f} {x + w / 2:.1f},{y - h * 0.28:.1f} {x + w + 2:.1f},{y:.1f}" fill="{ROOF}"/>'
        )
    parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="2" fill="#fff" opacity=".7"/>')
    cols = max(1, int(w // 11))
    for i in range(cols):
        wx = x + (i + 0.5) * w / cols - 2
        for row in (0.25, 0.6):
            if h * row + 7 < h:
                parts.append(f'<rect x="{wx:.1f}" y="{y + h * row:.1f}" width="4" height="7" fill="#4a5a6a" opacity=".75"/>')
    return "".join(parts)


def dome_church(x, base_y, s, dome=BLUE_DOME, towers=0):
    """Church centred on x, sitting on base_y, scaled by s."""
    w, h = 60 * s, 34 * s
    left = x - w / 2
    p = [
        f'<rect x="{left:.1f}" y="{base_y - h:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{WHITE}"/>',
        f'<rect x="{x - 12 * s:.1f}" y="{base_y - h - 12 * s:.1f}" width="{24 * s:.1f}" height="{12 * s:.1f}" fill="{WHITE}"/>',
        f'<path d="M{x - 14 * s:.1f},{base_y - h - 12 * s:.1f} A{14 * s:.1f},{15 * s:.1f} 0 0 1 {x + 14 * s:.1f},{base_y - h - 12 * s:.1f} Z" fill="{dome}"/>',
        f'<rect x="{x - 1 * s:.1f}" y="{base_y - h - 34 * s:.1f}" width="{2 * s:.1f}" height="{9 * s:.1f}" fill="{WHITE}"/>',
        f'<rect x="{x - 4 * s:.1f}" y="{base_y - h - 31 * s:.1f}" width="{8 * s:.1f}" height="{2 * s:.1f}" fill="{WHITE}"/>',
        f'<rect x="{x - 5 * s:.1f}" y="{base_y - 16 * s:.1f}" width="{10 * s:.1f}" height="{16 * s:.1f}" rx="{5 * s:.1f}" fill="{WINDOW}"/>',
    ]
    for side in ([-1, 1] if towers == 2 else [1] if towers == 1 else []):
        tx = x + side * (w / 2 - 6 * s) - 6 * s
        p += [
            f'<rect x="{tx:.1f}" y="{base_y - h - 26 * s:.1f}" width="{12 * s:.1f}" height="{26 * s:.1f}" fill="{WHITE}"/>',
            f'<rect x="{tx + 3.5 * s:.1f}" y="{base_y - h - 21 * s:.1f}" width="{5 * s:.1f}" height="{8 * s:.1f}" rx="{2.5 * s:.1f}" fill="{WINDOW}"/>',
            f'<path d="M{tx:.1f},{base_y - h - 26 * s:.1f} A{6 * s:.1f},{7 * s:.1f} 0 0 1 {tx + 12 * s:.1f},{base_y - h - 26 * s:.1f} Z" fill="{dome}"/>',
        ]
    return "".join(p)


def cathedral_tower(x, base_y, s):
    """San Giorgio on Ano Syros: a basilica with a square bell tower."""
    return "".join([
        f'<rect x="{x - 30 * s:.1f}" y="{base_y - 30 * s:.1f}" width="{60 * s:.1f}" height="{30 * s:.1f}" fill="{WHITE}"/>',
        f'<polygon points="{x - 32 * s:.1f},{base_y - 30 * s:.1f} {x:.1f},{base_y - 42 * s:.1f} {x + 32 * s:.1f},{base_y - 30 * s:.1f}" fill="{SHADE}"/>',
        f'<rect x="{x + 16 * s:.1f}" y="{base_y - 70 * s:.1f}" width="{16 * s:.1f}" height="{70 * s:.1f}" fill="{WHITE}"/>',
        f'<rect x="{x + 20 * s:.1f}" y="{base_y - 62 * s:.1f}" width="{8 * s:.1f}" height="{12 * s:.1f}" rx="{4 * s:.1f}" fill="{WINDOW}"/>',
        f'<polygon points="{x + 14 * s:.1f},{base_y - 70 * s:.1f} {x + 24 * s:.1f},{base_y - 84 * s:.1f} {x + 34 * s:.1f},{base_y - 70 * s:.1f}" fill="{SHADE}"/>',
        f'<rect x="{x + 23 * s:.1f}" y="{base_y - 94 * s:.1f}" width="{2 * s:.1f}" height="{11 * s:.1f}" fill="{WHITE}"/>',
        f'<rect x="{x + 20 * s:.1f}" y="{base_y - 91 * s:.1f}" width="{8 * s:.1f}" height="{2 * s:.1f}" fill="{WHITE}"/>',
    ])


def cover_hill(fn, x0, x1, y_limit, rnd, dense=0.9, size=(12, 26), maker="cube"):
    """Fill a hill with buildings, drawn top-down so lower rows overlap."""
    peak = min(fn(x) for x in range(int(x0), int(x1)))
    out, y = [], peak + 4
    while y < y_limit:
        row_h = rnd.uniform(*size) * 0.8
        x = x0
        while x < x1:
            w = rnd.uniform(*size)
            if fn(x) < y - 4 and fn(x + w) < y - 4 and rnd.random() < dense:
                h = rnd.uniform(size[0] * 0.8, size[1] * 0.9)
                if maker == "cube":
                    out.append(cube(x, y - h * 0.3, w, h, rnd))
                else:
                    out.append(mansion(x, y - h * 0.3, w, h, rnd))
            x += w + rnd.uniform(-1, 3)
        y += row_h
    return "".join(out)


def sea(y, w, h, gid, rnd, streaks=60, light="#ffffff"):
    body = [f'<rect x="0" y="{y}" width="{w}" height="{h - y}" fill="url(#{gid})"/>']
    for _ in range(streaks):
        sy = rnd.uniform(y + 6, h)
        sw = rnd.uniform(20, 120) * (0.5 + (sy - y) / (h - y))
        sx = rnd.uniform(-50, w)
        body.append(
            f'<rect x="{sx:.0f}" y="{sy:.0f}" width="{sw:.0f}" height="2" rx="1" fill="{light}" opacity="{rnd.uniform(.12, .4):.2f}"/>'
        )
    return "".join(body)


def boat(x, y, s, hull="#fbfaf6", stripe="#1f5fa8", sail=False, sail_color=WHITE):
    p = [
        f'<path d="M{x:.1f},{y:.1f} L{x + 60 * s:.1f},{y:.1f} L{x + 50 * s:.1f},{y + 12 * s:.1f} L{x + 8 * s:.1f},{y + 12 * s:.1f} Z" fill="{hull}"/>',
        f'<rect x="{x + 4 * s:.1f}" y="{y + 3 * s:.1f}" width="{52 * s:.1f}" height="{2.5 * s:.1f}" fill="{stripe}"/>',
    ]
    if sail:
        p.append(f'<path d="M{x + 30 * s:.1f},{y - 2 * s:.1f} L{x + 30 * s:.1f},{y - 48 * s:.1f} L{x + 52 * s:.1f},{y - 4 * s:.1f} Z" fill="{sail_color}"/>')
        p.append(f'<rect x="{x + 29 * s:.1f}" y="{y - 50 * s:.1f}" width="{1.5 * s:.1f}" height="{50 * s:.1f}" fill="#3b3b3b"/>')
    else:
        p.append(f'<rect x="{x + 20 * s:.1f}" y="{y - 8 * s:.1f}" width="{16 * s:.1f}" height="{8 * s:.1f}" fill="{hull}"/>')
    return "".join(p)


def ferry(x, y, s):
    return "".join([
        f'<path d="M{x:.1f},{y:.1f} L{x + 240 * s:.1f},{y:.1f} L{x + 225 * s:.1f},{y + 26 * s:.1f} L{x + 12 * s:.1f},{y + 26 * s:.1f} Z" fill="{WHITE}"/>',
        f'<rect x="{x + 6 * s:.1f}" y="{y + 10 * s:.1f}" width="{228 * s:.1f}" height="{5 * s:.1f}" fill="{BLUE_DOME}"/>',
        f'<rect x="{x + 50 * s:.1f}" y="{y - 22 * s:.1f}" width="{150 * s:.1f}" height="{22 * s:.1f}" fill="{WHITE}"/>',
        f'<rect x="{x + 90 * s:.1f}" y="{y - 38 * s:.1f}" width="{80 * s:.1f}" height="{16 * s:.1f}" fill="{WHITE}"/>',
        "".join(f'<rect x="{x + (58 + i * 14) * s:.1f}" y="{y - 16 * s:.1f}" width="{8 * s:.1f}" height="{6 * s:.1f}" fill="{WINDOW}"/>' for i in range(10)),
        f'<rect x="{x + 150 * s:.1f}" y="{y - 56 * s:.1f}" width="{14 * s:.1f}" height="{18 * s:.1f}" fill="{BLUE_DOME}"/>',
    ])


def stars(w, h_max, n, rnd):
    return "".join(
        f'<circle cx="{rnd.uniform(0, w):.0f}" cy="{rnd.uniform(0, h_max):.0f}" r="{rnd.uniform(.6, 1.8):.1f}" fill="#fff" opacity="{rnd.uniform(.3, .9):.2f}"/>'
        for _ in range(n)
    )


# --------------------------------------------------------------------------- scenes

def hero():
    rnd = random.Random(1821)
    W, H = 1600, 900
    ano = hill_fn(470, 250, 250, 760)
    vrontado = hill_fn(1180, 330, 230, 760)
    b = ["<defs>",
         grad("hs", [(0, "#8ec3e6"), (.55, "#cfe4ef"), (1, "#f7dcb4")]),
         grad("hsea", [(0, "#2a86c2"), (.4, "#1668a8"), (1, "#0a3a66")]),
         '<radialGradient id="hsun" cx=".78" cy=".3" r=".35"><stop offset="0" stop-color="#fff6dc" stop-opacity=".9"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>',
         "</defs>",
         f'<rect width="{W}" height="{H}" fill="url(#hs)"/>',
         f'<rect width="{W}" height="{H}" fill="url(#hsun)"/>',
         f'<circle cx="1250" cy="200" r="46" fill="#fff4d6" opacity=".95"/>',
         f'<path d="{ridge_path([(0, 520), (180, 470), (340, 500), (620, 430), (820, 470), (980, 440), (1250, 480), (1420, 450), (1600, 490)], 760, W)}" fill="#b9cbd6" opacity=".8"/>',
         f'<path d="{hill_path(vrontado, 760, W, 760)}" fill="#d9c49a"/>',
         f'<path d="{hill_path(ano, 0, 980, 760)}" fill="#cdb68a"/>',
         ]
    b.append(cover_hill(vrontado, 900, 1470, 700, rnd, dense=.7, size=(16, 30), maker="mansion"))
    b.append(dome_church(1180, 352, 1.3, towers=2))  # Anastasi
    b.append(cover_hill(ano, 230, 720, 640, rnd, dense=.95, size=(12, 24)))
    b.append(cathedral_tower(470, 262, 1.1))  # San Giorgio
    # lower neoclassical town along the waterfront
    x = -10
    while x < W:
        w = rnd.uniform(34, 70)
        h = rnd.uniform(40, 80)
        b.append(mansion(x, 760 - h - rnd.uniform(0, 40), w, h + 40, rnd))
        x += w + rnd.uniform(0, 4)
    # Town hall (Ziller) in the middle
    b.append('<rect x="700" y="640" width="200" height="120" fill="#efe3c6"/>'
             '<rect x="770" y="608" width="60" height="40" fill="#efe3c6"/>'
             '<path d="M770,608 A30,26 0 0 1 830,608 Z" fill="#6f8a8f"/>'
             + "".join(f'<rect x="{712 + i * 22}" y="{662 + r * 36}" width="10" height="22" fill="#5b6570"/>' for i in range(9) for r in range(2))
             + '<rect x="690" y="632" width="220" height="10" fill="#e5d6b3"/>')
    # Agios Nikolaos in Vaporia
    b.append(dome_church(1390, 700, 1.5, towers=2))
    b.append(f'<rect x="0" y="752" width="{W}" height="14" fill="#e9e1cf"/>')
    b.append(sea(764, W, H, "hsea", rnd, 90))
    b.append(ferry(120, 790, 1.2))
    b.append(boat(760, 800, 1.1))
    b.append(boat(980, 830, .9, stripe="#c8553d", sail=True))
    b.append(boat(1300, 812, 1.0, stripe="#e0a458"))
    return svg(W, H, "".join(b), "Ermoupoli seen from the harbour, with Ano Syros on the left hill")


def ano_syros():
    rnd = random.Random(1205)
    W, H = 800, 600
    hill = hill_fn(400, 170, 220, 620)
    b = ["<defs>",
         grad("as", [(0, "#1d2350"), (.45, "#5b4a86"), (.8, "#e3869a"), (1, "#f6c29a")]),
         "</defs>",
         f'<rect width="{W}" height="{H}" fill="url(#as)"/>',
         stars(W, 220, 70, rnd),
         '<circle cx="640" cy="110" r="22" fill="#fdf1d0" opacity=".9"/>',
         f'<path d="{hill_path(hill, 0, W, H)}" fill="#6a5a78"/>',
         ]
    houses = cover_hill(hill, 120, 690, H + 20, rnd, dense=.97, size=(14, 26))
    b.append(f'<g opacity=".92">{houses}</g>')
    b.append(cathedral_tower(400, 182, .8))
    # warm lit windows
    for _ in range(90):
        x = rnd.uniform(140, 660)
        y = rnd.uniform(hill(x) + 10, H)
        b.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="3" height="4" fill="#ffd27a" opacity="{rnd.uniform(.6, 1):.2f}"/>')
    b.append(f'<rect width="{W}" height="{H}" fill="#3b2f5c" opacity=".18"/>')
    return svg(W, H, "".join(b), "Ano Syros, the medieval hilltop village, at dusk")


def vaporia():
    rnd = random.Random(1870)
    W, H = 800, 600
    b = ["<defs>",
         grad("vs", [(0, "#7fc0ea"), (1, "#e6f2f7")]),
         grad("vsea", [(0, "#2aa0c8"), (1, "#0c4a7a")]),
         "</defs>",
         f'<rect width="{W}" height="{H}" fill="url(#vs)"/>',
         ]
    # mansions stepping down to the sea
    x = -10
    while x < W:
        w = rnd.uniform(70, 120)
        h = rnd.uniform(120, 190)
        b.append(mansion(x, 420 - h, w, h, rnd))
        # balconies
        b.append(f'<rect x="{x + 6:.0f}" y="{420 - h * .45:.0f}" width="{w - 12:.0f}" height="3" fill="#3d4a55"/>')
        x += w + 2
    b.append(dome_church(400, 300, 2.6, towers=2))
    # rocks and swimming ladders
    b.append('<path d="M0,420 L800,420 L800,450 L0,460 Z" fill="#cfc6b4"/>')
    b.append('<path d="M0,455 C120,440 200,470 330,452 C460,440 560,468 800,446 L800,470 L0,480 Z" fill="#a89c86"/>')
    b.append(sea(465, W, H, "vsea", rnd, 50))
    for lx in (180, 520):
        b.append(f'<rect x="{lx}" y="440" width="3" height="50" fill="#dcdcdc"/><rect x="{lx + 16}" y="440" width="3" height="50" fill="#dcdcdc"/>'
                 + "".join(f'<rect x="{lx}" y="{450 + i * 10}" width="19" height="2" fill="#dcdcdc"/>' for i in range(4)))
    b.append('<circle cx="300" cy="520" r="7" fill="#e3a07a"/><path d="M288,520 q12,8 24,0" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>')
    return svg(W, H, "".join(b), "Vaporia: captains' mansions and the blue dome of Agios Nikolaos above the sea")


def miaouli():
    rnd = random.Random(1891)
    W, H = 800, 600
    b = ["<defs>",
         grad("ms", [(0, "#9fd0ef"), (1, "#f4f0e6")]),
         grad("mfloor", [(0, "#f1ebe0"), (1, "#d6cdbd")]),
         "</defs>",
         f'<rect width="{W}" height="{H}" fill="url(#ms)"/>',
         # town hall body
         '<rect x="90" y="210" width="620" height="260" fill="#f2e4c4"/>',
         '<rect x="80" y="196" width="640" height="18" fill="#e6d4ac"/>',
         '<rect x="320" y="120" width="160" height="90" fill="#f2e4c4"/>',
         '<path d="M320,120 A80,62 0 0 1 480,120 Z" fill="#6f8a8f"/>',
         '<rect x="396" y="40" width="8" height="30" fill="#6f8a8f"/>',
         '<circle cx="400" cy="160" r="22" fill="#fbf6ea" stroke="#b69b6a" stroke-width="3"/>',
         '<path d="M400,160 L400,146 M400,160 L410,166" stroke="#4a3f2d" stroke-width="2.5"/>',
         # columns & windows
         "".join(f'<rect x="{110 + i * 58}" y="236" width="26" height="60" rx="13" fill="#5b6570"/>'
                 f'<rect x="{110 + i * 58}" y="330" width="26" height="70" rx="13" fill="#5b6570"/>' for i in range(11)),
         "".join(f'<rect x="{104 + i * 58}" y="228" width="38" height="4" fill="#e6d4ac"/>' for i in range(11)),
         # grand staircase
         "".join(f'<rect x="{300 - i * 14}" y="{430 + i * 8}" width="{200 + i * 28}" height="8" fill="#{"ece3d2" if i % 2 else "e2d7c3"}"/>' for i in range(8)),
         '<rect x="360" y="400" width="80" height="30" fill="#5b6570"/>',
         '<rect x="0" y="494" width="800" height="106" fill="url(#mfloor)"/>',
         ]
    # marble paving pattern
    for i in range(0, 800, 40):
        b.append(f'<path d="M{i},494 L{(i - 400) * 1.8 + 400:.0f},600" stroke="#c9bfad" stroke-width="1"/>')
    # palms
    for px in (40, 760):
        b.append(f'<rect x="{px - 5}" y="300" width="10" height="200" fill="#8a6b45"/>')
        for a in range(0, 360, 40):
            r = math.radians(a)
            b.append(f'<path d="M{px},300 Q{px + 50 * math.cos(r):.0f},{300 + 30 * math.sin(r) - 30:.0f} {px + 80 * math.cos(r):.0f},{300 + 50 * math.sin(r) + 10:.0f}" stroke="#4f7a3a" stroke-width="7" fill="none" stroke-linecap="round"/>')
    # people strolling
    for _ in range(9):
        x = rnd.uniform(60, 740)
        y = rnd.uniform(520, 580)
        c = rnd.choice(["#c8553d", "#1f5fa8", "#e0a458", "#3b3b3b", "#7d8a4e"])
        b.append(f'<circle cx="{x:.0f}" cy="{y - 26:.0f}" r="5" fill="#8a5a44"/><rect x="{x - 5:.0f}" y="{y - 21:.0f}" width="10" height="22" rx="4" fill="{c}"/>')
    return svg(W, H, "".join(b), "Miaouli Square and the neoclassical Town Hall of Ermoupoli")


def kini():
    rnd = random.Random(1936)
    W, H = 800, 600
    b = ["<defs>",
         grad("ks", [(0, "#3a2a5c"), (.45, "#c65a6a"), (.75, "#f39a5a"), (1, "#ffd48a")]),
         grad("ksea", [(0, "#e0875a"), (.3, "#7a4a6a"), (1, "#1c2244")]),
         "</defs>",
         f'<rect width="{W}" height="{H}" fill="url(#ks)"/>',
         '<circle cx="400" cy="372" r="54" fill="#ffe6a6"/>',
         f'<path d="{ridge_path([(0, 250), (90, 280), (190, 330), (260, 380), (300, 392)], 400, 300)}" fill="#3a2440"/>',
         '<path d="M500,392 L560,370 L650,300 L730,250 L800,230 L800,400 L500,400 Z" fill="#3a2440"/>',
         ]
    b.append(sea(392, W, H, "ksea", rnd, 0))
    # sun glitter path
    for i in range(40):
        y = 396 + i * 5
        w = 20 + i * 3 + rnd.uniform(-10, 10)
        b.append(f'<rect x="{400 - w / 2 + rnd.uniform(-8, 8):.0f}" y="{y}" width="{w:.0f}" height="2" fill="#ffe6a6" opacity="{.85 - i * .018:.2f}"/>')
    b.append('<path d="M0,540 C160,520 320,560 520,540 C640,530 720,548 800,540 L800,600 L0,600 Z" fill="#2a1a2e"/>')
    b.append(boat(160, 460, 1.0, hull="#2a1a2e", stripe="#2a1a2e"))
    b.append(boat(590, 440, .7, hull="#2a1a2e", stripe="#2a1a2e", sail=True, sail_color="#2a1a2e"))
    # tamarisk silhouette
    b.append('<rect x="700" y="420" width="10" height="130" fill="#1a1020"/>')
    for _ in range(40):
        b.append(f'<circle cx="{705 + rnd.uniform(-70, 60):.0f}" cy="{400 + rnd.uniform(-50, 30):.0f}" r="{rnd.uniform(10, 24):.0f}" fill="#1a1020"/>')
    for _ in range(12):
        b.append(f'<path d="M{rnd.uniform(100, 700):.0f},{rnd.uniform(80, 220):.0f} q6,-6 12,0 q6,-6 12,0" stroke="#2a1a2e" stroke-width="2" fill="none"/>')
    return svg(W, H, "".join(b), "Sunset over Kini bay on the west coast")


def galissas():
    rnd = random.Random(1965)
    W, H = 800, 600
    b = ["<defs>",
         grad("gs", [(0, "#6fb8e8"), (1, "#dff0f7")]),
         grad("gsea", [(0, "#1b6fae"), (.55, "#2bb3c7"), (1, "#8fe0d8")]),
         grad("gsand", [(0, "#f1dfb6"), (1, "#e3c890")]),
         "</defs>",
         f'<rect width="{W}" height="{H}" fill="url(#gs)"/>',
         '<ellipse cx="200" cy="90" rx="70" ry="16" fill="#fff" opacity=".8"/><ellipse cx="240" cy="80" rx="40" ry="14" fill="#fff" opacity=".8"/>',
         '<path d="M0,300 L0,160 C60,150 140,190 200,230 C240,260 260,290 280,310 Z" fill="#b89c6e"/>',
         '<path d="M800,310 L520,310 C560,270 620,210 700,170 C740,150 780,150 800,160 Z" fill="#a98e62"/>',
         ]
    b.append(dome_church(110, 188, .7))  # Agia Pakou on its rock
    b.append(sea(300, W, 470, "gsea", rnd, 40))
    b.append('<path d="M0,470 C200,440 600,440 800,470 L800,600 L0,600 Z" fill="url(#gsand)"/>')
    b.append('<path d="M0,470 C200,440 600,440 800,470" stroke="#fff" stroke-width="5" fill="none" opacity=".75"/>')
    # umbrellas & towels
    for i, x in enumerate((120, 260, 420, 580, 700)):
        c = ["#c8553d", "#1f5fa8", "#e0a458", "#2bb3c7", "#f0cfc0"][i]
        b.append(f'<rect x="{x - 1}" y="{480 + i % 2 * 30}" width="3" height="50" fill="#6b5a44"/>'
                 f'<path d="M{x - 36},{490 + i % 2 * 30} Q{x},{450 + i % 2 * 30} {x + 36},{490 + i % 2 * 30} Z" fill="{c}"/>'
                 f'<rect x="{x + 10}" y="{540 + i % 2 * 20}" width="44" height="14" rx="3" fill="{rnd.choice(PASTELS)}"/>')
    # tamarisks along the sand
    for tx in (30, 770):
        b.append(f'<rect x="{tx - 5}" y="470" width="10" height="100" fill="#7a5c3c"/>')
        for _ in range(30):
            b.append(f'<circle cx="{tx + rnd.uniform(-60, 60):.0f}" cy="{450 + rnd.uniform(-40, 30):.0f}" r="{rnd.uniform(10, 22):.0f}" fill="{rnd.choice(["#6d8a4a", "#7d9a55", "#5c7a3e"])}"/>')
    b.append(boat(480, 360, .8, stripe="#c8553d", sail=True))
    return svg(W, H, "".join(b), "The sandy bay of Galissas with the chapel of Agia Pakou")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    scenes = {
        "hero.svg": hero,
        "ano-syros.svg": ano_syros,
        "vaporia.svg": vaporia,
        "miaouli.svg": miaouli,
        "kini.svg": kini,
        "galissas.svg": galissas,
    }
    for name, fn in scenes.items():
        (OUT / name).write_text(fn(), encoding="utf-8")
        print(f"wrote {OUT / name}")


if __name__ == "__main__":
    main()
