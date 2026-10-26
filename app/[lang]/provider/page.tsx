import { redirect } from 'next/navigation';
import { ArrowRight, BarChart3, BriefcaseBusiness, Check, CreditCard, MessageCircle, Sparkles } from 'lucide-react';
import { createClient } from '../../../lib/supabase/server';
import { ProviderAcceptButton } from '../../../components/provider-request-actions';
import { LeadStatusButton } from '../../../components/lead-status-button';
import { BillingPortalButton } from '../../../components/billing-portal-button';
import { AppHeader } from '../../../components/app-header';
import { dateLocale, isLocale, lp, type Locale } from '../../../lib/i18n/config';
import { getDictionary, statusLabel } from '../../../lib/i18n/dictionaries';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProviderPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const p = t.provider;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, '/provider'))}`);
  const { data: business } = await supabase.from('businesses').select('id,name,category,postcode,verified,active').eq('owner_id', user.id).limit(1).maybeSingle();
  if (!business) redirect(lp(lang, '/signup/account?role=provider'));

  const [{ data: subscription }, { data: plan }, { data: matches }, { data: leads }, { data: conversations }, { data: notifications }, { count: views }, { count: contacts }] = await Promise.all([
    supabase.from('business_subscriptions').select('plan_key,status,current_period_end,stripe_customer_id').eq('business_id', business.id).maybeSingle(),
    supabase.from('business_subscriptions').select('business_plans(name,monthly_price_cents,included_leads,featured)').eq('business_id', business.id).maybeSingle(),
    supabase.from('request_providers').select('request_id,status,invited_at,service_requests(id,category,description,postcode,preferred_timing,status,created_at)').eq('business_id', business.id).order('invited_at', { ascending: false }).limit(30),
    supabase.from('leads').select('id,status,qualified,price_cents,created_at,service_requests(category,description,postcode,preferred_timing)').eq('business_id', business.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('conversations').select('id,status,updated_at,service_requests(category,description)').eq('business_id', business.id).order('updated_at', { ascending: false }).limit(20),
    supabase.from('notifications').select('id,title,body,read_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('business_id', business.id).eq('event_name', 'business_view').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('business_id', business.id).in('event_name', ['business_contact','phone_click','whatsapp_click','website_click']).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  const pending = (matches || []).filter((item: any) => item.status === 'invited');
  const activePlan = (plan as any)?.business_plans || { name: p.freePlan, monthly_price_cents: 0, included_leads: 3, featured: false };
  const leadCount = leads?.length || 0;
  const cat = (value?: string | null) => (value ? (t.requestForm.categories[value] ?? value) : t.common.request);
  const timing = (value?: string | null) => (value ? (t.requestForm.timing[value] ?? value) : '');
  const L = (path: string) => lp(lang, path);

  return <div className="ds-page"><AppHeader links={[[L('/businesses'), t.nav.businesses], [L('/provider/profile'), p.profileNav], [L('/voor-bedrijven'), p.growthNav]]} /><main id="main" className="platform-shell ds-platform"><div className="platform-dashboard">
    <div className="provider-profile-strip"><div className="provider-avatar"><BriefcaseBusiness aria-hidden="true" /></div><div><span className="uo-kicker">{p.kicker}</span><h1>{business.name}</h1><p>{business.category} · {business.postcode || t.common.town}</p></div><span className={`verification-pill ${business.verified ? 'verified' : ''}`}>{business.verified ? t.common.verified : p.inReview}</span></div>
    <div className="monetization-metrics"><div><span>{p.views}</span><strong>{views || 0}</strong><small>{p.last30}</small></div><div><span>{p.contacts}</span><strong>{contacts || 0}</strong><small>{p.contactsSub}</small></div><div><span>{p.leads}</span><strong>{leadCount}</strong><small>{p.leadsSub}</small></div><div><span>{p.plan}</span><strong>{activePlan.name}</strong><small>{p.included(activePlan.included_leads)}</small></div></div>
    <section className="business-growth-card"><div><span className="uo-kicker">{p.growthKicker}</span><h2>{p.growthTitle}</h2><p>{p.growthText}</p></div><a href={L('/voor-bedrijven')}>{p.viewPlans} <ArrowRight aria-hidden="true" /></a></section>
    <section className="dashboard-grid"><div className="dashboard-main">
      <div className="dashboard-section"><div className="dashboard-section-head"><h2>{p.newRequests}</h2><span>{pending.length}</span></div>{pending.length ? pending.map((match: any) => { const request = match.service_requests; return <article className="provider-request-row" key={match.request_id}><div><span>{cat(request?.category)}</span><h3>{request?.description}</h3><p>{request?.postcode} · {timing(request?.preferred_timing)}</p></div><ProviderAcceptButton requestId={match.request_id} /></article>; }) : <div className="dashboard-empty">{p.noNewRequests}</div>}</div>
      <div className="dashboard-section"><div className="dashboard-section-head"><h2>{p.leads}</h2><span>{leadCount}</span></div>{leads?.length ? leads.map((lead: any) => <article className="lead-row" key={lead.id}><div className="lead-row-copy"><span>{cat(lead.service_requests?.category)}</span><h3>{lead.service_requests?.description || p.localRequest}</h3><p>{lead.service_requests?.postcode || t.common.town} · {new Date(lead.created_at).toLocaleDateString(dateLocale(lang))}</p></div><div className="lead-row-actions"><span className={`lead-pill lead-${lead.status}`}>{statusLabel(t, lead.status)}</span>{lead.status === 'new' ? <LeadStatusButton leadId={lead.id} status={lead.status} nextStatus="viewed" label={p.actView} /> : null}{lead.status === 'viewed' ? <LeadStatusButton leadId={lead.id} status={lead.status} nextStatus="accepted" label={p.actAccept} /> : null}{lead.status === 'accepted' ? <LeadStatusButton leadId={lead.id} status={lead.status} nextStatus="contacted" label={p.actContacted} /> : null}{lead.status === 'contacted' ? <LeadStatusButton leadId={lead.id} status={lead.status} nextStatus="converted" label={p.actWon} /> : null}</div></article>) : <div className="dashboard-empty">{p.noLeads}</div>}</div>
      <div className="dashboard-section"><div className="dashboard-section-head"><h2>{t.account.conversations}</h2><span>{conversations?.length || 0}</span></div>{conversations?.length ? conversations.map((conversation: any) => <a className="conversation-row" href={L(`/messages/${conversation.id}`)} key={conversation.id}><MessageCircle aria-hidden="true" /><div><strong>{cat(conversation.service_requests?.category)}</strong><small>{conversation.service_requests?.description || p.customerConversation}</small></div><span>{statusLabel(t, conversation.status)}</span><ArrowRight aria-hidden="true" /></a>) : <div className="dashboard-empty">{p.noConversations}</div>}</div>
    </div>
    <aside className="dashboard-side"><div className="dashboard-section"><div className="dashboard-section-head"><h2>{p.yourPlan}</h2><CreditCard aria-hidden="true" /></div><div className="plan-summary"><strong>{activePlan.name}</strong><span>€{activePlan.monthly_price_cents ? (activePlan.monthly_price_cents / 100).toFixed(0) : '0'} {p.perMonth}</span><small>{p.included(activePlan.included_leads)} · {activePlan.featured ? p.promoIncluded : p.basicProfile}</small></div><a className="dashboard-side-link" href={L('/voor-bedrijven#prijzen')}>{p.upgrade} <ArrowRight aria-hidden="true" /></a>{subscription?.stripe_customer_id ? <BillingPortalButton /> : null}</div>
      <div className="dashboard-section"><div className="dashboard-section-head"><h2>{p.whatYouGet}</h2><Sparkles aria-hidden="true" /></div><ul className="benefit-list">{p.benefits.map((benefit) => <li key={benefit}><Check aria-hidden="true" /> {benefit}</li>)}</ul></div>
      <div className="dashboard-section"><div className="dashboard-section-head"><h2>{t.account.notifications}</h2><BarChart3 aria-hidden="true" /></div>{notifications?.length ? notifications.map(n => <div className="notification-row" key={n.id}><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString(dateLocale(lang))}</small></div>) : <div className="dashboard-empty">{t.account.noNotifications}</div>}</div>
    </aside></section></div></main></div>;
}
