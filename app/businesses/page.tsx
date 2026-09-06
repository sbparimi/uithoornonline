import type { Metadata } from 'next';
import { createClient } from '../../lib/supabase/server';
import { ProviderDirectory } from '../../components/provider-directory';

export const metadata: Metadata = { title: 'Lokale aanbieders — Uithoorn.online', description: 'Vind lokale ondernemers en diensten in Uithoorn en De Kwakel.' };

export default async function BusinessesPage() {
  let verifiedBusinesses: Array<{ id: string; name: string; category: string; description: string; postcode: string | null; website: string | null; phone: string | null; verified: boolean }> = [];
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (configured) {
    const supabase = await createClient();
    const result = await supabase.from('businesses').select('id,name,category,description,postcode,website,phone,verified').eq('active', true).eq('verified', true).order('name');
    verifiedBusinesses = result.data || [];
  }
  const items = verifiedBusinesses.map((b) => ({ id: b.id, title: b.name, meta: b.category, description: b.description || 'Lokale aanbieder in Uithoorn en De Kwakel.', postcode: b.postcode || 'Uithoorn', website: b.website, phone: b.phone, verified: true }));
  return <ProviderDirectory items={items} />;
}
