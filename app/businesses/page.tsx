import type { Metadata } from 'next';
import { createClient } from '../../lib/supabase/server';
import { businesses as fallbackBusinesses } from '../../data';
import { ProviderDirectory } from '../../components/provider-directory';

export const metadata: Metadata = { title: 'Lokale aanbieders — Uithoorn.online', description: 'Vind lokale ondernemers en diensten in Uithoorn en De Kwakel.' };

export default async function BusinessesPage() {
  const supabase = await createClient();
  const { data: verifiedBusinesses } = await supabase.from('businesses').select('id,name,category,description,postcode,website,phone,verified').eq('active', true).eq('verified', true).order('name');
  const databaseItems = (verifiedBusinesses || []).map((b) => ({ id: b.id, title: b.name, meta: b.category, description: b.description || 'Lokale aanbieder in Uithoorn en De Kwakel.', postcode: b.postcode || 'Uithoorn', website: b.website, phone: b.phone, verified: true }));
  const items = databaseItems.length ? databaseItems : fallbackBusinesses.filter((b) => b.name !== 'SpiceIndia').map((b) => ({ id: null, title: b.name, meta: b.type, description: b.desc, postcode: 'Uithoorn', website: null, phone: null, verified: false }));
  return <ProviderDirectory items={items} />;
}
