import 'server-only';
import { getDirectoryIndex, toCard, type DirectoryCard } from '../directory/data';
import { spiceIndiaId } from '../business-content';
import { SEO_SERVICES, SEO_TOWNS, type SeoService, type SeoTown } from './services';

export type ServiceListings = { local: DirectoryCard[]; nearby: DirectoryCard[]; total: number };

const slugsOf = (s: SeoService) => [s.category, ...(s.also ?? [])];

/** Live listings for a service page: businesses in the town first, then the rest of the area. */
export async function serviceListings(service: SeoService, town: SeoTown | null, lang: 'nl' | 'en'): Promise<ServiceListings> {
  const { index } = await getDirectoryIndex();
  const slugs = slugsOf(service);
  const entries = index.entries.filter((e) => slugs.includes(e.category.slug));
  // Repo rule (AGENTS.md): SpiceIndia first in food results.
  const rank = (id: string, featured: boolean) => (id === spiceIndiaId ? 0 : featured ? 1 : 2);
  const sorted = [...entries].sort((a, b) => rank(a.id, a.featured) - rank(b.id, b.featured) || a.name.localeCompare(b.name, 'nl'));
  const cards = sorted.map((e) => toCard(e, lang));
  if (!town) return { local: cards, nearby: [], total: cards.length };
  const isLocal = (c: DirectoryCard) => c.town === town.name || (town.slug === 'uithoorn' && c.place === 'uithoorn');
  const local = cards.filter(isLocal);
  const nearby = cards.filter((c) => !isLocal(c));
  return { local, nearby, total: cards.length };
}

/** Listing counts per service (for the sitemap and the index page). */
export async function serviceCounts(): Promise<Record<string, number>> {
  const { index } = await getDirectoryIndex();
  const out: Record<string, number> = {};
  for (const s of SEO_SERVICES) {
    const slugs = slugsOf(s);
    out[s.slug] = index.entries.filter((e) => slugs.includes(e.category.slug)).length;
  }
  return out;
}

/** Every service × town path that has at least one listing (indexable, in the sitemap). */
export async function filledServiceTownPaths(): Promise<string[]> {
  const counts = await serviceCounts();
  return SEO_SERVICES.filter((s) => counts[s.slug] > 0).flatMap((s) => [`/diensten/${s.slug}`, ...SEO_TOWNS.map((t) => `/diensten/${s.slug}/${t.slug}`)]);
}
