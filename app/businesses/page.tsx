import type { Metadata } from 'next';
import { createClient } from '../../lib/supabase/server';
import { ProviderDirectory } from '../../components/provider-directory';

const siteUrl = 'https://uithoorn.online';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ search?: string }> }): Promise<Metadata> {
  const params = await searchParams;
  const query = params.search?.trim();
  if (query) {
    return {
      title: `${query} in Uithoorn — Uithoorn.online`,
      description: `Vind lokale bedrijven en professionals voor ${query} in Uithoorn en De Kwakel. Zoek aanbieders of vraag lokale hulp via Uithoorn.online.`,
      alternates: { canonical: `${siteUrl}/businesses?search=${encodeURIComponent(query)}` },
    };
  }
  return {
    title: 'Lokale bedrijven en diensten in Uithoorn — Uithoorn.online',
    description: 'Vind lokale bedrijven, loodgieters, tuinprofessionals, klusbedrijven, catering en andere diensten in Uithoorn en De Kwakel. Zoek of vraag lokale hulp.',
    alternates: { canonical: `${siteUrl}/businesses` },
    keywords: ['bedrijven Uithoorn', 'diensten Uithoorn', 'loodgieter Uithoorn', 'tuinman Uithoorn', 'klusbedrijf Uithoorn', 'handyman Uithoorn', 'catering Uithoorn', 'De Kwakel bedrijven'],
  };
}

type Business = { id: string; name: string; category: string; description: string; postcode: string | null; website: string | null; phone: string | null; verified: boolean };

const verifiedSeedBusinesses: Business[] = [
  { id: '15953249-c000-4521-839d-41bf341b6aa8', name: 'SpiceIndia', category: 'Indian food & catering', description: 'South Indian home kitchen in Uithoorn offering freshly prepared takeaway and catering. Specialities include Andhra-style biryani, dosa, idli and vada. Pickup only; no delivery. Catering available in Uithoorn and Amstelveen.', postcode: '1421', website: 'https://www.spiceindia.nl/', phone: '+31 6 45480446', verified: true },
  { id: '68efa8f0-6e5f-4ea9-ba5b-94fbff1fba35', name: 'Ruslen', category: 'Garden renovation, paving, tiling & fencing', description: 'Local contractor for garden renovation and outdoor works, including paving, tiles and fencing. Contact Ruslen for project details, scope and quotation.', postcode: '1421', website: null, phone: '+31616270233', verified: true },
];

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const params = await searchParams;
  let verifiedBusinesses: Business[] = [];
  try {
    const supabase = await createClient();
    const result = await supabase.from('businesses').select('id,name,category,description,postcode,website,phone,verified').eq('active', true).eq('verified', true).order('name');
    if (result.error) {
      const message = result.error.message || '';
      if (!/configuration is missing|SUPABASE_/i.test(message)) console.error('[businesses] provider query failed', { code: result.error.code, message: result.error.message });
    }
    verifiedBusinesses = result.data || [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/configuration is missing|SUPABASE_/i.test(message)) console.error('[businesses] provider query exception', message);
  }
  if (verifiedBusinesses.length === 0) verifiedBusinesses = verifiedSeedBusinesses;
  const items = verifiedBusinesses.map((b) => ({ id: b.id, title: b.name, meta: b.category, description: b.description || 'Lokale aanbieder in Uithoorn en De Kwakel.', postcode: b.postcode || 'Uithoorn', website: b.website, phone: b.phone, verified: true }));

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Lokale bedrijven en diensten in Uithoorn',
    description: 'Lokale bedrijven, professionals en diensten in Uithoorn en De Kwakel.',
    url: `${siteUrl}/businesses`,
    isPartOf: { '@type': 'WebSite', name: 'Uithoorn.online', url: siteUrl },
    about: { '@type': 'Place', name: 'Uithoorn, Netherlands' },
    mainEntity: { '@type': 'ItemList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.title, url: `${siteUrl}/businesses/${item.id}` })) },
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <ProviderDirectory items={items} initialQuery={params.search ?? ''} showDemandFilters />
  </>;
}
