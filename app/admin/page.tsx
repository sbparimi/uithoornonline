import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { AdminVerifyButton } from '../../components/admin-verify-button';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');
  const { data: businesses } = await supabase.from('businesses').select('id,name,category,postcode,verified,active,created_at').order('created_at', { ascending: false });
  const pending = (businesses || []).filter(b => !b.verified);
  return <main className="platform-shell"><header className="platform-header"><a className="uo-brand" href="/"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><form action="/api/auth/signout" method="post"><button>Uitloggen</button></form></header><div className="platform-dashboard"><span className="uo-kicker">Platform beheer</span><h1>Moderatie.</h1><p>Verifieer lokale aanbieders voordat ze aanvragen ontvangen en publiek zichtbaar worden.</p><section className="dashboard-section" style={{ marginTop: 30 }}><div className="dashboard-section-head"><h2>Wacht op verificatie</h2><span>{pending.length}</span></div>{pending.length ? pending.map(b => <article className="provider-request-row" key={b.id}><div><span>{b.category}</span><h3>{b.name}</h3><p>{b.postcode || 'Uithoorn'} · Aangemeld {new Date(b.created_at).toLocaleDateString('nl-NL')}</p></div><AdminVerifyButton businessId={b.id} /></article>) : <div className="dashboard-empty">Geen aanbieders wachten op verificatie.</div>}</section></div></main>;
}
