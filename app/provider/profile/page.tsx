import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import ProviderProfileForm from '../../../components/provider-profile-form';

export default async function ProviderProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/provider/profile');
  const { data: business } = await supabase.from('businesses').select('id,name,category,description,postcode,address,website,phone,verified').eq('owner_id', user.id).limit(1).maybeSingle();
  if (!business) redirect('/signup/account?role=provider');
  return <main className="platform-shell"><header className="platform-header"><a className="uo-brand" href="/"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><a href="/provider">Terug naar dashboard</a></header><div className="platform-dashboard"><div className="platform-dashboard-head"><div><span className="uo-kicker">Aanbieder</span><h1>Beheer je profiel.</h1><p>Houd je diensten, contactgegevens en lokale informatie actueel.</p></div></div><ProviderProfileForm business={business} /></div></main>;
}
