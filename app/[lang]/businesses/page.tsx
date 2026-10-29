import type { Metadata } from 'next';
import { listPublicBusinesses } from '../../../lib/data/businesses';
import { ProviderDirectory } from '../../../components/provider-directory';
import { localizeBusiness, spiceIndiaId, type PublicBusiness } from '../../../lib/business-content';
import { alternatesFor, isLocale, lp, seo, SITE_URL, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';
import { jsonLd } from '../../../lib/json-ld';

const foodSearchPattern = /food|eten|restaurant|cater|catering|takeaway|thuiskeuken|bakker|bakery|taart|indian|indiaas|spiceindia|biryani|dosa|idli|vada|lunch|dinner|maaltijd/i;

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ search?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang).directory;
  const query = sp.search?.trim();
  const alternates = alternatesFor(lang, '/businesses');
  if (query) {
    return { title: t.queryTitle(query), description: t.queryDescription(query), alternates: { ...alternates, canonical: `${SITE_URL}${lp(lang, '/businesses')}?search=${encodeURIComponent(query)}` }, robots: { index: false, follow: true } };
  }
  return { title: t.metaTitle, description: t.metaDescription, ...seo(lang, '/businesses', t.metaTitle, t.metaDescription) };
}

export default async function BusinessesPage({ params, searchParams }: Props) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  // Approved, active listings from the database; the built-in list only if the database is unreachable.
  let businesses: PublicBusiness[] = (await listPublicBusinesses()).businesses;

  const query = sp.search?.trim() ?? '';
  if (foodSearchPattern.test(query)) {
    businesses = [...businesses].sort((a, b) => (a.id === spiceIndiaId ? -1 : b.id === spiceIndiaId ? 1 : a.name.localeCompare(b.name)));
  }

  const items = businesses.map((raw) => {
    const b = localizeBusiness(raw, lang);
    return { id: b.id, title: b.name, meta: b.category, description: b.description || t.common.localProviderDesc, postcode: b.postcode || '', website: b.website, phone: b.phone, verified: b.verified, searchText: `${raw.category} ${raw.description}` };
  });

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.directory.ldName,
    description: t.directory.ldDescription,
    inLanguage: lang === 'nl' ? 'nl-NL' : 'en',
    url: `${SITE_URL}${lp(lang, '/businesses')}`,
    isPartOf: { '@type': 'WebSite', name: 'Uithoorn.online', url: SITE_URL },
    about: { '@type': 'Place', name: 'Uithoorn, Nederland' },
    mainEntity: { '@type': 'ItemList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.title, url: `${SITE_URL}${lp(lang, `/businesses/${item.id}`)}` })) },
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    <ProviderDirectory items={items} initialQuery={query} />
  </>;
}
