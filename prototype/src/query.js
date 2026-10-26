// Rule-based parser for plain-language "occasion" queries (docs/DESIGN.md §6).
// e.g. "cheap lunch near Les Gets, beginner with kids" →
//      { category: 'restaurant', maxLevel: 1, place: 'les_gets', tags: ['budget', 'kids'] }

const CATEGORY_WORDS = [
  { words: ['loo', 'toilet', 'toilets', 'wc', 'bathroom', 'restroom', 'toilettes'], category: 'toilet' },
  { words: ['apres', 'après', 'drink', 'drinks', 'bar', 'beer', 'pint', 'wine', 'cocktail'], category: 'bar', tags: ['apres'] },
  { words: ['hire', 'rental', 'rent', 'repair', 'broken', 'binding', 'wax'], category: 'shop', subtype: 'rental' },
  { words: ['pharmacy', 'chemist', 'plasters', 'paracetamol', 'pharmacie'], category: 'shop', subtype: 'pharmacy' },
  { words: ['groceries', 'supermarket', 'food shop', 'supplies'], category: 'shop', subtype: 'supermarket' },
  { words: ['shop', 'shops', 'shopping'], category: 'shop' },
  { words: ['cash', 'atm', 'money', 'cashpoint'], category: 'atm' },
  { words: ['injured', 'injury', 'doctor', 'medical', 'first aid', 'hurt'], category: 'firstaid' },
  { words: ['lunch', 'eat', 'food', 'restaurant', 'dinner', 'breakfast', 'coffee', 'cafe', 'café', 'snack', 'hungry'], category: 'restaurant' },
];

const LEVEL_WORDS = [
  { words: ['beginner', 'novice', 'first time', 'green', 'greens', 'learning'], level: 1 },
  { words: ['intermediate', 'blue', 'blues'], level: 2 },
  { words: ['confident', 'advanced', 'red', 'reds'], level: 3 },
  { words: ['expert', 'black', 'blacks', 'any run', 'anything'], level: 4 },
];

const MODE_WORDS = [
  { words: ['walking', 'on foot', 'not skiing', 'non skier', 'non-skier', 'pedestrian', 'walk'], mode: 'walk' },
  { words: ['snowboard', 'snowboarder', 'snowboarding', 'boarder', 'board'], mode: 'snowboard' },
  { words: ['ski', 'skiing', 'skier', 'skis'], mode: 'ski' },
];

const TAG_WORDS = [
  { words: ['kids', 'children', 'family', 'child'], tag: 'kids' },
  { words: ['cheap', 'budget', 'affordable', 'inexpensive'], tag: 'budget' },
  { words: ['terrace', 'sunny', 'sun', 'view', 'outside'], tag: 'terrace' },
  { words: ['live music', 'band', 'music'], tag: 'live-music' },
  { words: ['self service', 'self-service', 'quick'], tag: 'self-service' },
  { words: ['table service', 'sit down', 'sit-down', 'posh'], tag: 'table-service' },
];

export function normalise(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function has(text, phrase) {
  return new RegExp(`(^|\\s)${normalise(phrase)}(\\s|$)`).test(text);
}

function matchPlace(text, nodes) {
  // Prefer the longest matching name so "super morzine" wins over "morzine".
  let found = null;
  for (const n of nodes) {
    for (const name of [n.name, ...(n.aliases ?? [])]) {
      const norm = normalise(name.replace(/\(.*\)/, ''));
      if (has(text, norm) && (!found || norm.length > found.len)) found = { id: n.id, len: norm.length };
    }
  }
  return found?.id ?? null;
}

export function parseQuery(query, nodes) {
  const text = normalise(query);
  const result = { tags: [] };

  for (const c of CATEGORY_WORDS) {
    if (c.words.some((w) => has(text, w))) {
      Object.assign(result, { category: c.category, subtype: c.subtype });
      result.tags.push(...(c.tags ?? []));
      break;
    }
  }
  for (const l of LEVEL_WORDS) {
    if (l.words.some((w) => has(text, w))) {
      result.maxLevel = l.level;
      break;
    }
  }
  for (const m of MODE_WORDS) {
    if (m.words.some((w) => has(text, w))) {
      result.mode = m.mode;
      break;
    }
  }
  for (const t of TAG_WORDS) {
    if (t.words.some((w) => has(text, w)) && !result.tags.includes(t.tag)) result.tags.push(t.tag);
  }
  result.place = matchPlace(text, nodes);
  if (result.subtype === undefined) delete result.subtype;
  return result;
}
