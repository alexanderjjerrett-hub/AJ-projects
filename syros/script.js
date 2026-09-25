document.documentElement.classList.add("js");

// ---------- navigation ----------
const nav = document.querySelector(".nav");
const toggle = document.querySelector(".nav-toggle");

const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});
document.querySelectorAll("#nav-links a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

// ---------- reveal on scroll ----------
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
} else {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
}

// ---------- beach explorer ----------
// Positions are on the illustrative 400×600 map, not real coordinates.
const beaches = [
  { name: "Grammata", where: "North-west coast", x: 152, y: 70, label: "left",
    desc: "A remote, sheltered bay reached by boat or a long hike. Sailors waiting out storms carved prayers and thanks into its rocks from antiquity onward — the inscriptions give the bay its name.",
    tags: ["Boat access", "Remote", "History"] },
  { name: "Lia", where: "North coast", x: 212, y: 100, label: "right",
    desc: "A quiet cove at the end of a winding road through the empty north. Clear water, a mix of sand and pebbles, and not much else — which is the point.",
    tags: ["Remote", "Clear water", "Unorganised"] },
  { name: "Delfini", where: "West coast", x: 136, y: 218, label: "left",
    desc: "A wide bay just north of Kini with a relaxed beach bar and long views over the open Aegean.",
    tags: ["Sand & pebbles", "Beach bar", "Views"] },
  { name: "Kini", where: "West coast", x: 128, y: 252, label: "left",
    desc: "A sandy beach in a working fishing village — go for a swim in the afternoon and stay for fresh fish and one of the best sunsets on the island.",
    tags: ["Sand", "Sunset", "Tavernas", "Bus"] },
  { name: "Galissas", where: "West coast", x: 84, y: 332, label: "left",
    desc: "A deep, sandy bay shaded by tamarisks, with the little chapel of Agia Pakou on the rocks. Shallow water and plenty of tavernas.",
    tags: ["Sand", "Shallow", "Family", "Bus"] },
  { name: "Foinikas", where: "South-west coast", x: 94, y: 448, label: "left",
    desc: "A calm, tree-lined beach beside a small marina, with cafés just behind the sand.",
    tags: ["Sheltered", "Shade", "Marina"] },
  { name: "Agathopes", where: "South-west coast", x: 116, y: 528, label: "left",
    desc: "Fine sand and bright turquoise shallows near Posidonia, looking out to a small islet offshore.",
    tags: ["Sand", "Turquoise", "Shallow"] },
  { name: "Komito", where: "South coast", x: 180, y: 556, label: "left",
    desc: "A small, peaceful sandy cove at the end of a dirt road, fringed by trees — bring your own shade and snacks.",
    tags: ["Quiet", "Sand", "Unorganised"] },
  { name: "Megas Gialos", where: "South coast", x: 238, y: 550, label: "right",
    desc: "The 'long beach': a stretch of sand in a quiet village with tavernas and plenty of room to spread out.",
    tags: ["Sand", "Family", "Tavernas", "Bus"] },
  { name: "Vari", where: "South-east coast", x: 318, y: 476, label: "right",
    desc: "A sheltered horseshoe bay with shallow, calm water — protected from the summer meltemi winds and ideal for children.",
    tags: ["Sheltered", "Shallow", "Family", "Bus"] },
  { name: "Azolimnos", where: "East coast", x: 330, y: 380, label: "below",
    desc: "The closest organised beach to Ermoupoli: a small, lively bay with sunbeds, cafés and a few fishing boats.",
    tags: ["Near town", "Organised", "Cafés"] },
];

const svgNS = "http://www.w3.org/2000/svg";
const pins = document.querySelector(".map-pins");
const list = document.querySelector(".beach-list");
const panel = {
  where: document.getElementById("beach-where"),
  name: document.getElementById("beach-name"),
  desc: document.getElementById("beach-desc"),
  tags: document.getElementById("beach-tags"),
};

function selectBeach(i) {
  const b = beaches[i];
  panel.where.textContent = b.where;
  panel.name.textContent = b.name;
  panel.desc.textContent = b.desc;
  panel.tags.replaceChildren(...b.tags.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
  pins.querySelectorAll(".pin").forEach((p, j) => p.classList.toggle("active", i === j));
  list.querySelectorAll("button").forEach((btn, j) => btn.setAttribute("aria-pressed", i === j));
}

beaches.forEach((b, i) => {
  const g = document.createElementNS(svgNS, "g");
  g.setAttribute("class", "pin");
  g.setAttribute("tabindex", "0");
  g.setAttribute("role", "button");
  g.setAttribute("aria-label", `${b.name} beach`);

  const c = document.createElementNS(svgNS, "circle");
  c.setAttribute("cx", b.x);
  c.setAttribute("cy", b.y);
  c.setAttribute("r", 7);

  const t = document.createElementNS(svgNS, "text");
  const pos = {
    left: [b.x - 12, b.y + 4, "end"],
    right: [b.x + 12, b.y + 4, "start"],
    below: [b.x, b.y + 22, "middle"],
  }[b.label];
  t.setAttribute("x", pos[0]);
  t.setAttribute("y", pos[1]);
  t.setAttribute("text-anchor", pos[2]);
  t.textContent = b.name;

  g.append(c, t);
  g.addEventListener("click", () => selectBeach(i));
  g.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectBeach(i);
    }
  });
  pins.append(g);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = b.name;
  btn.addEventListener("click", () => selectBeach(i));
  list.append(btn);
});

selectBeach(beaches.findIndex((b) => b.name === "Galissas"));

// ---------- seasons ----------
const seasons = {
  spring: "Wildflowers on the hills, green valleys, and Easter — when Catholic and Orthodox processions fill the streets of Ermoupoli.",
  summer: "Hot, bright days cooled by the meltemi wind. The sea is at its warmest, and the Festival Aegean brings opera to the Apollo Theatre.",
  autumn: "Warm sea, soft light and quiet beaches — many say September and October are the island's finest months.",
  winter: "Unlike many Cycladic islands, Syros never closes: cafés, theatres and tavernas stay open for the people who live here all year.",
};
const seasonText = document.querySelector(".season-text");
document.querySelectorAll(".seasons button").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".seasons button").forEach((b) => b.setAttribute("aria-selected", b === btn));
    seasonText.textContent = seasons[btn.dataset.season];
  })
);
