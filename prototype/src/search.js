// "Nearest X I can reach from here": ranks POIs by ability-aware travel time.

import { shortestPaths, route, describe, toMinutes, toClock } from './routing.js';

// How long people typically stay, used to check there's still a way home afterwards.
const DWELL = { restaurant: 75, bar: 90, toilet: 5, shop: 20, atm: 5, firstaid: 30 };
const MISSING_TAG_PENALTY = 20; // minutes-equivalent per unmet preference

export function search(graph, { origin, profile, category, subtype, tags = [], depart, returnTo, limit = 5 }) {
  const reach = shortestPaths(graph, origin, profile, depart);
  const home = returnTo ?? origin;
  const results = [];

  for (const poi of graph.pois) {
    if (category && poi.category !== category) continue;
    if (subtype && poi.subtype !== subtype) continue;
    const r = reach.get(poi.node);
    if (!r) continue;

    const warnings = [];
    const opens = toMinutes(poi.open);
    let closes = toMinutes(poi.close);
    if (closes <= opens) closes += 24 * 60; // open past midnight
    if (r.arrival >= closes) continue;
    if (r.arrival < opens) warnings.push(`Opens at ${poi.open}`);

    const missingTags = tags.filter((t) => !poi.tags.includes(t));
    const minutes = Math.round(r.arrival - depart);
    const info = describe(graph, r.path);
    if (info.crossesBorder) warnings.push('Route crosses into Switzerland: prices in CHF, local piste grading');

    if (poi.node !== home) {
      const leave = Math.max(r.arrival, opens) + (DWELL[poi.category] ?? 30);
      const back = route(graph, poi.node, home, profile, leave);
      const homeName = graph.nodes.find((n) => n.id === home)?.name ?? home;
      if (!back) warnings.push(`No lift or bus back to ${homeName} after ~${toClock(leave)}: plan a taxi or leave earlier`);
    }

    results.push({
      poi,
      minutes,
      arrival: toClock(r.arrival),
      route: { ...info, path: r.path },
      missingTags,
      warnings,
      score: r.cost + missingTags.length * MISSING_TAG_PENALTY,
    });
  }

  results.sort((a, b) => a.score - b.score);
  return results.slice(0, limit);
}
