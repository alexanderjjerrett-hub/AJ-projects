// Ability-aware, time-dependent routing over the ski-area graph.
// See docs/DESIGN.md §5 for the model.

import { LEVEL_NAMES } from './data.js';

// Typical cruising speed on piste (metres per minute) by the user's maximum level.
const PISTE_SPEED = { 1: 200, 2: 300, 3: 400, 4: 450 };
// Runs at the top of the user's ability are taken more cautiously.
const AT_LIMIT_FACTOR = 1.3;
const WALK_SPEED = 70; // metres per minute (snowy village, boots)
// Extra cost (minutes) for things people dislike; affects ranking, not reported time.
const PENALTY = { flatOnBoard: 4, dragOnBoard: 15, busWithSkis: 3 };

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toClock(minutes) {
  const m = Math.round(minutes) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function isOnSnow(profile) {
  return profile.mode === 'ski' || profile.mode === 'snowboard';
}

// Builds the directed arcs a given traveller is allowed to use.
export function arcsFor(graphEdges, profile) {
  const onSnow = isOnSnow(profile);
  const board = profile.mode === 'snowboard';
  const avoidDrag = profile.avoidDrag ?? board;
  const arcs = [];
  const add = (edge, from, to, extra) => arcs.push({ edge, from, to, penalty: 0, ...extra });

  for (const e of graphEdges) {
    switch (e.type) {
      case 'piste': {
        if (!onSnow || e.level > profile.maxLevel) break;
        let minutes = e.length / PISTE_SPEED[profile.maxLevel];
        if (e.level === profile.maxLevel) minutes *= AT_LIMIT_FACTOR;
        add(e, e.from, e.to, { minutes, penalty: board && e.flat ? PENALTY.flatOnBoard : 0 });
        break;
      }
      case 'lift': {
        const ride = { minutes: e.minutes, wait: e.wait ?? 0, open: e.open, close: e.close };
        const upOk = onSnow || e.pedestrian;
        if (upOk) {
          const dragPenalty = onSnow && e.liftType === 'drag' && avoidDrag ? PENALTY.dragOnBoard : 0;
          add(e, e.from, e.to, { ...ride, penalty: dragPenalty, direction: 'up' });
        }
        if (e.download && (onSnow || e.pedestrian)) {
          add(e, e.to, e.from, { ...ride, direction: 'down' });
        }
        break;
      }
      case 'bus': {
        const ride = { minutes: e.minutes, wait: e.wait ?? 0, open: e.open, close: e.close, penalty: onSnow ? PENALTY.busWithSkis : 0 };
        add(e, e.from, e.to, ride);
        add(e, e.to, e.from, ride);
        break;
      }
      case 'walk': {
        const minutes = e.length / WALK_SPEED;
        add(e, e.from, e.to, { minutes });
        add(e, e.to, e.from, { minutes });
        break;
      }
    }
  }
  return arcs;
}

// Clock time at which an arc is left, or null if it can't be used.
// Users may wait for a lift or bus to open, but cannot board after it closes.
function traverse(arc, clock) {
  let start = clock;
  if (arc.open) {
    start = Math.max(start, toMinutes(arc.open));
    if (start + (arc.wait ?? 0) > toMinutes(arc.close)) return null;
  }
  return start + (arc.wait ?? 0) + arc.minutes;
}

// Time-dependent Dijkstra from `origin`. Returns Map<nodeId, {cost, arrival, path}>.
export function shortestPaths(graph, origin, profile, departMinutes) {
  const arcs = arcsFor(graph.edges, profile);
  const out = new Map();
  for (const a of arcs) {
    if (!out.has(a.from)) out.set(a.from, []);
    out.get(a.from).push(a);
  }

  const best = new Map([[origin, { cost: 0, arrival: departMinutes, path: [] }]]);
  const done = new Set();
  // The graph is small (hundreds of nodes even for the full area), so a linear scan beats a heap here.
  while (true) {
    let current = null;
    for (const [id, label] of best) {
      if (!done.has(id) && (current === null || label.cost < best.get(current).cost)) current = id;
    }
    if (current === null) break;
    done.add(current);
    const label = best.get(current);

    for (const arc of out.get(current) ?? []) {
      if (done.has(arc.to)) continue;
      const arrival = traverse(arc, label.arrival);
      if (arrival === null) continue;
      const cost = label.cost + (arrival - label.arrival) + arc.penalty;
      const prev = best.get(arc.to);
      if (!prev || cost < prev.cost) {
        best.set(arc.to, {
          cost,
          arrival,
          path: [...label.path, { ...arc, depart: label.arrival, arrive: arrival }],
        });
      }
    }
  }
  return best;
}

export function route(graph, origin, destination, profile, departMinutes) {
  return shortestPaths(graph, origin, profile, departMinutes).get(destination) ?? null;
}

// Human-readable steps plus a summary for a path.
export function describe(graph, path) {
  const nodeName = (id) => graph.nodes.find((n) => n.id === id)?.name ?? id;
  let hardest = 0;
  let crossesBorder = false;
  const steps = path.map((s) => {
    const e = s.edge;
    const fromN = graph.nodes.find((n) => n.id === s.from);
    const toN = graph.nodes.find((n) => n.id === s.to);
    if (fromN && toN && fromN.country !== toN.country) crossesBorder = true;
    let text;
    if (e.type === 'piste') {
      hardest = Math.max(hardest, e.level);
      text = `Ski ${e.name} (${LEVEL_NAMES[e.level]}) to ${nodeName(s.to)}`;
    } else if (e.type === 'lift') {
      text = s.direction === 'down'
        ? `Ride ${e.name} down to ${nodeName(s.to)}`
        : `Take ${e.name} up to ${nodeName(s.to)}`;
      if (e.close) text += ` (last ride ${e.close})`;
    } else if (e.type === 'bus') {
      text = `Shuttle bus to ${nodeName(s.to)} (${e.name})`;
    } else {
      text = `Walk to ${nodeName(s.to)}`;
    }
    return { text, type: e.type, level: e.level, depart: toClock(s.depart), arrive: toClock(s.arrive) };
  });
  return { steps, hardest: hardest ? LEVEL_NAMES[hardest] : null, crossesBorder };
}
