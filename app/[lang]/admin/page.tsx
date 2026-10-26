import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { AdminVerifyButton } from '../../../components/admin-verify-button';
import { AppHeader } from '../../../components/app-header';
import { dateLocale, isLocale, lp, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const a = t.admin;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, '/admin'))}`);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect(lp(lang, '/'));
  const { data: businesses } = await supabase.from('businesses').select('id,name,category,postcode,verified,active,created_at').order('created_at', { ascending: false });
  const pending = (businesses || []).filter(b => !b.verified);
  return <div className="ds-page"><AppHeader /><main id="main" className="platform-shell ds-platform"><div className="platform-dashboard"><span className="uo-kicker">{a.kicker}</span><h1>{a.title}</h1><p>{a.intro}</p><section className="dashboard-section" style={{ marginTop: 30 }}><div className="dashboard-section-head"><h2>{a.pending}</h2><span>{pending.length}</span></div>{pending.length ? pending.map(b => <article className="provider-request-row" key={b.id}><div><span>{b.category}</span><h3>{b.name}</h3><p>{b.postcode || t.common.town} · {a.registered} {new Date(b.created_at).toLocaleDateString(dateLocale(lang))}</p></div><AdminVerifyButton businessId={b.id} /></article>) : <div className="dashboard-empty">{a.none}</div>}</section></div></main></div>;
}
