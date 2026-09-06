import type { Metadata } from 'next';
import { ProviderDirectory } from '../../components/provider-directory';
import { createClient } from '../../lib/supabase/server';

export const metadata: Metadata = { title: 'Lokale diensten — Uithoorn.online', description: 'Vind betrouwbare lokale dienstverleners in Uithoorn en De Kwakel en neem direct contact op.' };

export default async function ServicesPage() {
  let businesses: Array<{ id: string; name: string; category: string; description: string; postcode: string | null; website: string | null; phone: string | null }> = [];
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (configured) {
    const supabase = await createClient();
    const result = await supabase.from('businesses').select('id,name,category,description,postcode,website,phone').eq('active', true).eq('verified', true).order('name');
    businesses = result.data || [];
  }
  return <ProviderDirectory items={businesses.map((b) => ({ id: b.id, title: b.name, meta: b.category, description: b.description || 'Lokale dienstverlener in Uithoorn en De Kwakel.', postcode: b.postcode || 'Uithoorn', website: b.website, phone: b.phone, verified: true }))} />;
}
