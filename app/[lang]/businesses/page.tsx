import type { Metadata } from 'next';
import { createClient } from '../../../lib/supabase/server';
import { ProviderDirectory } from '../../../components/provider-directory';
import { fallbackBusinesses, localizeBusiness, spiceIndiaId, type PublicBusiness } from '../../../lib/business-content';
import { alternatesFor, isLocale, lp, seo, SITE_URL, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

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
  let businesses: PublicBusiness[] = [];
  try {
    const supabase = await createClient();
    const result = await supabase.from('businesses').select('id,name,category,description,postcode,website,phone,verified').eq('active', true).order('name');
    if (result.error) {
      const message = result.error.message || '';
      if (!/configuration is missing|SUPABASE_|fetch failed/i.test(message)) console.error('[businesses] provider query failed', { code: result.error.code, message: result.error.message });
    }
    businesses = (result.data as PublicBusiness[] | null) || [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/configuration is missing|SUPABASE_|fetch failed/i.test(message)) console.error('[businesses] provider query exception', message);
  }
  if (businesses.length === 0) businesses = fallbackBusinesses;

  const query = sp.search?.trim() ?? '';
  if (foodSearchPattern.test(query)) {
    businesses = [...businesses].sort((a, b) => (a.id === spiceIndiaId ? -1 : b.id === spiceIndiaId ? 1 : a.name.localeCompare(b.name)));
  }

  const items = businesses.map((raw) => {
    const b = localizeBusiness(raw, lang);
    return { id: b.id, title: b.name, meta: b.category, description: b.description || t.common.localProviderDesc, postcode: b.postcode || t.common.town, website: b.website, phone: b.phone, verified: b.verified, searchText: `${raw.category} ${raw.description}` };
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
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <ProviderDirectory items={items} initialQuery={query} />
  </>;
}
