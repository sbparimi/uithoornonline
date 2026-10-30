import 'server-only';
import { query, DbUnavailableError } from '../db';
import { FALLBACK_BUSINESSES } from '../data/businesses';
import { localizeText, spiceIndiaId } from '../business-content';
import { isOpenNow } from '../hours';
import { buildIndex, searchDirectory, toEntry, type DirectoryEntry, type DirectoryIndex, type DirectoryQuery, type DirectorySource } from './search';
import { CATEGORY_BY_SLUG, SECTION_BY_ID, type PlaceId, type SectionId } from './taxonomy';

// Approved, active listings, indexed once per server instance and refreshed every 30 s, so a newly
// approved business shows up within half a minute without hitting the database on every keystroke.
const TTL_MS = 30_000;
declare global { var __uoDirectory: { index: DirectoryIndex; source: 'database' | 'fallback'; at: number; pending?: Promise<void> } | undefined; }

type Row = DirectorySource & { created_at: string };

async function load(): Promise<{ index: DirectoryIndex; source: 'database' | 'fallback' }> {
  let rows: Row[]; let source: 'database' | 'fallback' = 'database';
  try {
    rows = await query<Row>(`select id, name, category, description, postcode, address, website, phone, verified, featured, created_at, opening_hours
                               from businesses where moderation_status = 'approved' and active = true order by featured desc, name`)
      // Before migration 0006 there is no opening_hours column: same list without it.
      .catch((e) => { if ((e as { code?: string })?.code !== '42703') throw e; return query<Row>(`select id, name, category, description, postcode, address, website, phone, verified, featured, created_at
                               from businesses where moderation_status = 'approved' and active = true order by featured desc, name`); });
  } catch (error) {
    if (!(error instanceof DbUnavailableError)) throw error;
    rows = FALLBACK_BUSINESSES.map((b) => ({ ...b, address: null, created_at: '' }));
    source = 'fallback';
  }
  const entries = rows.map((r) => toEntry({ ...r, descriptionNl: localizeText(r.description, 'nl'), categoryNl: localizeText(r.category, 'nl') }));
  return { index: buildIndex(entries), source };
}

export async function getDirectoryIndex(): Promise<{ index: DirectoryIndex; source: 'database' | 'fallback' }> {
  const cached = globalThis.__uoDirectory;
  // A fallback index (database briefly unreachable, e.g. a cold start) is only kept for 15 s, so one blip
  // doesn't show the sample listings for the whole cache window.
  if (cached && Date.now() - cached.at < (cached.source === 'fallback' ? 15_000 : TTL_MS)) return cached;
  if (cached) {
    // Serve the previous index while one refresh runs in the background.
    if (!cached.pending) cached.pending = load().then((next) => { globalThis.__uoDirectory = { ...next, at: Date.now() }; }).catch((e) => { console.error('[directory] refresh failed', e instanceof Error ? e.message : e); cached.at = Date.now(); }).finally(() => { if (globalThis.__uoDirectory) globalThis.__uoDirectory.pending = undefined; });
    return cached;
  }
  const fresh = { ...(await load()), at: Date.now() };
  globalThis.__uoDirectory = fresh;
  return fresh;
}

export type DirectoryCard = {
  id: string; name: string; category: string; categorySlug: string; section: SectionId; line: string;
  town: string | null; place: PlaceId; postcode: string | null; phone: string | null; website: string | null; verified: boolean; featured: boolean;
  /** true/false from the business's opening hours (Europe/Amsterdam), null when it has none. */
  openNow: boolean | null;
};

function shortLine(text: string, max = 150) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[,.;:\s]+$/, '')}…`;
}

export function toCard(e: DirectoryEntry, lang: 'nl' | 'en'): DirectoryCard {
  const known = e.category.value === e.rawCategory;
  const category = known ? e.category[lang] : (lang === 'nl' ? e.categoryNl : e.rawCategory);
  return {
    id: e.id, name: e.name, category, categorySlug: e.category.slug, section: e.section,
    line: shortLine(lang === 'nl' ? e.descriptionNl : e.description),
    town: e.town, place: e.place, postcode: e.postcode, phone: e.phone, website: e.website, verified: e.verified, featured: e.featured,
    openNow: isOpenNow(e.hours),
  };
}

export type DirectoryPayload = {
  total: number; offset: number; limit: number; items: DirectoryCard[]; partial: boolean;
  facets: { sections: Record<string, number>; categories: Record<string, number>; places: Record<string, number>; all: number };
  suggestions: { categories: { slug: string; count: number }[]; sections: { id: SectionId; count: number }[] };
  totalListed: number; source: 'database' | 'fallback';
  /** How many listings have opening hours (the "Nu open" filter only shows when some do). */
  withHours: number;
};

export async function runDirectoryQuery(query: DirectoryQuery, lang: 'nl' | 'en'): Promise<DirectoryPayload> {
  const { index, source } = await getDirectoryIndex();
  const offset = query.offset ?? 0, limit = query.limit ?? 24;
  const result = searchDirectory(index, { ...query, offset, limit, pinId: spiceIndiaId });
  return { ...result, offset, limit, items: result.items.map((e) => toCard(e, lang)), totalListed: index.entries.length, source, withHours: index.entries.filter((e) => e.hours).length };
}

/** Parse URL search params (shared by the pages and the API) into a query. */
export function parseDirectoryParams(sp: Record<string, string | string[] | undefined>, fixed?: { section?: SectionId; category?: string }): DirectoryQuery & { page: number } {
  const one = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v)?.trim() ?? ''; };
  const q = (one('q') || one('search')).slice(0, 120);
  const sectionRaw = fixed?.section ?? one('sectie');
  const section = sectionRaw && SECTION_BY_ID.has(sectionRaw as SectionId) ? (sectionRaw as SectionId) : null;
  const catRaw = fixed?.category ?? one('categorie');
  const category = catRaw && CATEGORY_BY_SLUG.has(catRaw) ? catRaw : null;
  const placeRaw = one('plaats');
  const place = (['uithoorn', 'de-kwakel', 'omgeving'] as const).find((p) => p === placeRaw) ?? null;
  const has = one('met').split(',').filter((h): h is 'website' | 'phone' | 'open' => h === 'website' || h === 'phone' || h === 'open');
  const sortRaw = one('sort');
  const sort = sortRaw === 'az' || sortRaw === 'newest' ? sortRaw : 'relevance';
  const page = Math.min(500, Math.max(1, Number.parseInt(one('pagina') || '1', 10) || 1));
  return { q, section, category, place, has, sort, page };
}
