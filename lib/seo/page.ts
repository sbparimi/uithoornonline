import 'server-only';
import type { Metadata } from 'next';
import { lp, seo, type Locale } from '../i18n/config';
import { intakeEnabled } from '../urgent/flags';
import { serviceListings } from './listings';
import type { SeoService, SeoTown } from './services';
import { seoText } from './text';

/** "Hulp aanvragen": the AI intake (/hulp) when it is switched on, else the classic request form. */
export function requestHrefFor(lang: Locale, service: SeoService, source: string) {
  if (intakeEnabled()) return lp(lang, `/hulp?bron=${encodeURIComponent(source)}`);
  return lp(lang, `/request?category=${encodeURIComponent(service.request)}`);
}

export async function serviceMetadata(lang: Locale, service: SeoService, town: SeoTown | null): Promise<Metadata> {
  const t = seoText[lang];
  const c = service[lang];
  const listings = await serviceListings(service, town, lang);
  const path = town ? `/diensten/${service.slug}/${town.slug}` : `/diensten/${service.slug}`;
  const title = t.metaTitle(c.title, town?.name ?? null);
  const description = t.metaDescription(c.term, town?.name ?? null, listings.total);
  // Same rule as the directory: pages with nothing listed stay out of search indexes until filled.
  return { title, description, ...seo(lang, path, title, description), ...(listings.total === 0 ? { robots: { index: false, follow: true } } : {}) };
}
