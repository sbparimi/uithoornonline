// Directory search: a small in-memory inverted index over the approved listings, built once per
// data load on the server. Typo tolerant (edit distance), prefix aware (instant results while
// typing), and synonym aware (each category carries Dutch + English words, so "plumber" finds a
// "Loodgieter"). Pure TypeScript: no database or browser APIs, so it is unit-testable.
//
// Scale: a few thousand listings index in a few milliseconds and a query walks only the unique
// vocabulary, not every listing. Past ~20k listings, move the text match into Postgres (pg_trgm).
import { CATEGORIES, CATEGORY_BY_VALUE, SECTION_BY_ID, placeFromPostcode, type DirectoryCategory, type PlaceId, type SectionId } from './taxonomy';
import { cleanHours, isOpenNow, type OpeningHours } from '../hours';
import { OTHER_CATEGORY } from '../categories';

export type DirectorySource = {
  id: string; name: string; category: string; description: string | null;
  descriptionNl?: string | null; categoryNl?: string | null;
  postcode: string | null; address?: string | null; website: string | null; phone: string | null;
  verified: boolean; featured?: boolean; created_at?: string | Date | null;
  opening_hours?: unknown;
};

export type DirectoryEntry = {
  id: string; name: string; rawCategory: string; category: DirectoryCategory; section: SectionId;
  description: string; descriptionNl: string; categoryNl: string;
  postcode: string | null; address: string | null; town: string | null; place: PlaceId;
  website: string | null; phone: string | null; verified: boolean; featured: boolean; createdAt: number;
  hours: OpeningHours | null;
};

export type SortKey = 'relevance' | 'az' | 'newest';
export type HasFilter = 'website' | 'phone' | 'open';
export type DirectoryQuery = { q?: string; section?: SectionId | null; category?: string | null; place?: PlaceId | null; has?: HasFilter[]; sort?: SortKey; offset?: number; limit?: number; pinId?: string | null };

export type DirectoryResult = {
  total: number;
  items: DirectoryEntry[];
  partial: boolean; // no listing matched every word; these match some of them
  facets: { sections: Record<string, number>; categories: Record<string, number>; places: Record<string, number>; all: number };
  suggestions: { categories: { slug: string; count: number }[]; sections: { id: SectionId; count: number }[] };
};

// ---------- text ----------
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ĳ/g, 'ij')
    .replace(/(\d{4})\s?([a-z]{2})\b/g, '$1$2') // "1421 AB" -> one postcode word
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
const STOP = new Set(['de', 'het', 'een', 'en', 'in', 'te', 'bij', 'van', 'voor', 'met', 'op', 'aan', 'naar', 'ik', 'zoek', 'zoeken', 'nodig', 'mijn', 'the', 'a', 'an', 'and', 'near', 'me', 'for', 'of', 'to', 'my', 'need', 'looking', 'uithoorn']);
export function tokens(text: string): string[] {
  const out: string[] = [];
  for (const w of normalize(text).split(' ')) if (w && !STOP.has(w) && !out.includes(w)) out.push(w);
  return out;
}

/** Optimal-string-alignment distance with an early exit once it exceeds max. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length, m = b.length;
  let prev2: number[] = [], prev = Array.from({ length: m + 1 }, (_, j) => j), cur: number[] = [];
  for (let i = 1; i <= n; i++) {
    cur = [i];
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[m];
}

/** How well a query word matches an indexed word: 0 (no) .. 1 (exact). */
export function matchQuality(t: string, v: string): number {
  if (t === v) return 1;
  if (v.startsWith(t)) return t.length >= 3 ? 0.9 : t.length === 2 ? 0.6 : 0.4; // typing in progress
  if (t.length >= 5 && v.length >= 5 && t.startsWith(v)) return 0.75; // "loodgietersbedrijf" ~ "loodgieter"
  if (t.length < 5 || /\d/.test(t)) return 0;
  const allowed = t.length <= 7 ? 1 : 2;
  if (editDistance(t, v, allowed) <= allowed) return 0.7;
  if (v.length > t.length && t.length >= 5 && editDistance(t, v.slice(0, t.length), 1) <= 1) return 0.6; // typo while typing
  return 0;
}

// ---------- classification ----------
const categoryWords = CATEGORIES.map((c) => ({ c, words: new Set(tokens(`${c.value} ${c.nl} ${c.en} ${c.words}`)) }));

/** The known category for a stored value; free-text values ("Garden renovation, paving…") by their words. */
export function classifyCategory(raw: string, description = ''): DirectoryCategory {
  const known = CATEGORY_BY_VALUE.get(raw);
  if (known) return known;
  const pick = (text: string) => {
    const ws = tokens(text);
    let best: DirectoryCategory | null = null, bestScore = 0;
    for (const { c, words } of categoryWords) {
      if (c.value === OTHER_CATEGORY) continue;
      let s = 0;
      for (const w of ws) if (words.has(w)) s += 1; else if (w.length >= 5) { for (const cw of words) if (cw.length >= 5 && (cw.startsWith(w) || w.startsWith(cw))) { s += 0.6; break; } }
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return best;
  };
  return pick(raw) ?? pick(description) ?? CATEGORY_BY_VALUE.get(OTHER_CATEGORY)!;
}

export function toEntry(src: DirectorySource): DirectoryEntry {
  const category = classifyCategory(src.category, src.description || '');
  const { place, town } = placeFromPostcode(src.postcode);
  const created = src.created_at ? new Date(src.created_at).getTime() : 0;
  return {
    id: src.id, name: src.name.trim(), rawCategory: src.category, category, section: category.section,
    description: (src.description || '').trim(), descriptionNl: (src.descriptionNl || src.description || '').trim(), categoryNl: (src.categoryNl || src.category).trim(),
    postcode: src.postcode, address: src.address ?? null, town, place,
    website: src.website, phone: src.phone, verified: !!src.verified, featured: !!src.featured, createdAt: Number.isFinite(created) ? created : 0,
    hours: cleanHours(src.opening_hours),
  };
}

// ---------- index ----------
type Posting = { e: number; w: number };
export type DirectoryIndex = { entries: DirectoryEntry[]; vocab: Map<string, Posting[]>; builtAt: number };

const W = { name: 10, category: 7, location: 5, section: 4, description: 3 };

export function buildIndex(entries: DirectoryEntry[]): DirectoryIndex {
  const vocab = new Map<string, Posting[]>();
  entries.forEach((e, idx) => {
    const best = new Map<string, number>();
    const add = (text: string | null | undefined, w: number) => { if (!text) return; for (const t of normalize(text).split(' ')) if (t && (best.get(t) ?? 0) < w) best.set(t, w); };
    add(e.name, W.name);
    // Compound names ("Installatietechniek") also index their category words.
    add(`${e.rawCategory} ${e.categoryNl} ${e.category.nl} ${e.category.en} ${e.category.words}`, W.category);
    const s = SECTION_BY_ID.get(e.section); add(s ? `${s.nl} ${s.en}` : '', W.section);
    add(`${e.postcode ?? ''} ${(e.postcode ?? '').replace(/\s/g, '')} ${e.address ?? ''} ${e.town ?? ''}`, W.location);
    add(`${e.description} ${e.descriptionNl}`, W.description);
    for (const [t, w] of best) { const list = vocab.get(t); if (list) list.push({ e: idx, w }); else vocab.set(t, [{ e: idx, w }]); }
  });
  return { entries, vocab, builtAt: Date.now() };
}

/** Per-entry score for each query word (0 when a word does not match that entry). */
function scoreTokens(index: DirectoryIndex, toks: string[]): Map<number, number[]> {
  const perEntry = new Map<number, number[]>();
  toks.forEach((t, ti) => {
    for (const [v, postings] of index.vocab) {
      const q = matchQuality(t, v);
      if (!q) continue;
      for (const p of postings) {
        let arr = perEntry.get(p.e);
        if (!arr) { arr = new Array(toks.length).fill(0); perEntry.set(p.e, arr); }
        const s = p.w * q;
        if (s > arr[ti]) arr[ti] = s;
      }
    }
  });
  return perEntry;
}

export const FOOD_PATTERN = /food|eten|restaurant|cater|takeaway|afhaal|thuiskeuken|bakker|bakery|taart|indian|indiaas|spiceindia|biryani|dosa|idli|vada|lunch|dinner|diner|maaltijd|curry|thali/i;

export function searchDirectory(index: DirectoryIndex, query: DirectoryQuery): DirectoryResult {
  const { entries } = index;
  const toks = tokens(query.q ?? '');
  let textScore: Map<number, number> | null = null;
  let partial = false;
  if (toks.length) {
    const per = scoreTokens(index, toks);
    const all = new Map<number, number>();
    for (const [e, arr] of per) if (arr.every((s) => s > 0)) all.set(e, arr.reduce((a, b) => a + b, 0));
    if (all.size === 0 && toks.length > 1) {
      partial = per.size > 0;
      for (const [e, arr] of per) all.set(e, arr.reduce((a, b) => a + b, 0) - toks.length); // fewer words matched ranks lower
    }
    textScore = all;
  }
  const has = query.has ?? [];
  const now = new Date();
  const passHas = (e: DirectoryEntry) => has.every((h) => (h === 'website' ? !!e.website : h === 'open' ? isOpenNow(e.hours, now) === true : !!e.phone));
  const passText = (i: number) => !textScore || textScore.has(i);
  const passCat = (e: DirectoryEntry) => (!query.section || e.section === query.section) && (!query.category || e.category.slug === query.category);
  const passPlace = (e: DirectoryEntry) => !query.place || e.place === query.place;

  const facets = { sections: {} as Record<string, number>, categories: {} as Record<string, number>, places: {} as Record<string, number>, all: 0 };
  const matched: number[] = [];
  entries.forEach((e, i) => {
    if (!passText(i) || !passHas(e)) return;
    if (passPlace(e)) {
      facets.all++;
      facets.sections[e.section] = (facets.sections[e.section] ?? 0) + 1;
      if (!query.section || e.section === query.section) facets.categories[e.category.slug] = (facets.categories[e.category.slug] ?? 0) + 1;
    }
    if (passCat(e)) facets.places[e.place] = (facets.places[e.place] ?? 0) + 1;
    if (passCat(e) && passPlace(e)) matched.push(i);
  });

  const sort = query.sort ?? 'relevance';
  const byName = (a: number, b: number) => entries[a].name.localeCompare(entries[b].name, 'nl', { sensitivity: 'base' });
  const quality = (i: number) => (entries[i].featured ? 2 : 0) + (entries[i].verified ? 0.5 : 0);
  matched.sort((a, b) => {
    if (sort === 'az') return byName(a, b);
    if (sort === 'newest') return entries[b].createdAt - entries[a].createdAt || byName(a, b);
    const sa = (textScore?.get(a) ?? 0) + quality(a), sb = (textScore?.get(b) ?? 0) + quality(b);
    return sb - sa || byName(a, b);
  });

  // House rule (AGENTS.md): SpiceIndia is first for every food-related search it appears in.
  const foodIntent = (query.q && FOOD_PATTERN.test(query.q)) || query.section === 'eten-drinken' || (query.category && CATEGORIES.find((c) => c.slug === query.category)?.section === 'eten-drinken');
  if (query.pinId && foodIntent) {
    const at = matched.findIndex((i) => entries[i].id === query.pinId);
    if (at > 0) matched.unshift(...matched.splice(at, 1));
  }

  // Typeahead / "did you mean": categories whose own words match the query.
  const suggestions = { categories: [] as { slug: string; count: number }[], sections: [] as { id: SectionId; count: number }[] };
  if (toks.length) {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.category.slug, (counts.get(e.category.slug) ?? 0) + 1);
    const scored = categoryWords.map(({ c, words }) => {
      let total = 0;
      for (const t of toks) { let best = 0; for (const w of words) { const q = matchQuality(t, w); if (q > best) best = q; } total += best; }
      return { c, s: total / toks.length };
    }).filter((x) => x.s >= 0.6 && x.c.value !== OTHER_CATEGORY).sort((a, b) => b.s - a.s).slice(0, 4);
    suggestions.categories = scored.map(({ c }) => ({ slug: c.slug, count: counts.get(c.slug) ?? 0 }));
    const secs: SectionId[] = [];
    for (const { c } of scored) if (!secs.includes(c.section)) secs.push(c.section);
    suggestions.sections = secs.map((id) => ({ id, count: entries.filter((e) => e.section === id).length }));
  }

  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.min(100, Math.max(1, query.limit ?? 24));
  return { total: matched.length, items: matched.slice(offset, offset + limit).map((i) => entries[i]), partial, facets, suggestions };
}
