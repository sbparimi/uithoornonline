import { redirect } from 'next/navigation';
import { ArrowRight, BarChart3, BriefcaseBusiness, Check, CreditCard, MessageCircle, Sparkles } from 'lucide-react';
import { getCurrentUser } from '../../../lib/auth/session';
import { getProviderDashboard } from '../../../lib/data/dashboards';
import { getBackendDict } from '../../../lib/i18n/backend';
import { whatsappHref } from '../../../lib/i18n/config';
import { ProviderAcceptButton } from '../../../components/provider-request-actions';
import { LeadStatusButton } from '../../../components/lead-status-button';
import { AppHeader } from '../../../components/app-header';
import { dateLocale, isLocale, lp, type Locale } from '../../../lib/i18n/config';
import { getDictionary, statusLabel } from '../../../lib/i18n/dictionaries';
import type { Metadata } from 'next';
import { BUSINESS_OFFER_ANCHOR, PRICING_ENABLED } from '../../../lib/pricing';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === 'en' ? 'Business dashboard' : 'Bedrijfsdashboard', robots: { index: false, follow: false } };
}

export default async function ProviderPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const p = t.provider;
  const user = await getCurrentUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, '/provider'))}`);
  const data = await getProviderDashboard(user);
  if (!data) redirect(lp(lang, user.role === 'admin' ? '/admin' : '/signup/account?role=provider'));
  const { business, usage, leads, pending, conversations, notifications, views, contacts } = data;
  const b = getBackendDict(lang);
  const activePlan = data.plan;
  const leadCount = usage.usedThisMonth;
  const cat = (value?: string | null) => (value ? (t.requestForm.categories[value] ?? value) : t.common.request);
  const timing = (value?: string | null) => (value ? (t.requestForm.timing[value] ?? value) : '');
  const L = (path: string) => lp(lang, path);

  return <div className="ds-page"><AppHeader links={[[L('/businesses'), t.nav.businesses], [L('/provider/profile'), p.profileNav], [L('/voor-bedrijven'), p.growthNav]]} /><main id="main" className="platform-shell ds-platform"><div className="platform-dashboard">
    <div className="provider-profile-strip"><div className="provider-avatar"><BriefcaseBusiness aria-hidden="true" /></div><div><span className="uo-kicker">{p.kicker}</span><h1>{business.name}</h1><p>{business.category} · {business.postcode || t.common.town}</p></div><span className={`verification-pill ${business.verified ? 'verified' : ''}`}>{business.verified ? t.common.verified : p.inReview}</span></div>
    {business.moderation_status !== 'approved' && <div className="platform-notice" role="status"><strong>{business.moderation_status === 'rejected' ? b.leads.rejectedTitle : b.leads.pendingTitle}</strong><p>{business.moderation_status === 'rejected' ? b.leads.rejectedText : b.leads.pendingText}</p></div>}
    <p className="platform-usage">{PRICING_ENABLED ? b.leads.usage(usage.usedThisMonth, usage.includedLeads, usage.planName) : b.leads.usageFree(usage.usedThisMonth)}</p>
    <div className="monetization-metrics"><div><span>{p.views}</span><strong>{views || 0}</strong><small>{p.last30}</small></div><div><span>{p.contacts}</span><strong>{contacts || 0}</strong><small>{p.contactsSub}</small></div><div><span>{p.leads}</span><strong>{leadCount}</strong><small>{p.leadsSub}</small></div><div><span>{p.plan}</span><strong>{PRICING_ENABLED ? activePlan.name : p.freePlan}</strong><small>{PRICING_ENABLED ? p.included(activePlan.included_leads) : p.unlimited}</small></div></div>
    <section className="business-growth-card"><div><span className="uo-kicker">{p.growthKicker}</span><h2>{p.growthTitle}</h2><p>{p.growthText}</p></div>{PRICING_ENABLED ? <a href={L('/voor-bedrijven')}>{p.viewPlans} <ArrowRight aria-hidden="true" /></a> : <a href={L('/provider/profile')}>{p.completeProfile} <ArrowRight aria-hidden="true" /></a>}</section>
    <section className="dashboard-grid"><div className="dashboard-main">
      <div className="dashboard-section"><div className="dashboard-section-head"><h2>{p.newRequests}</h2><span>{pending.length}</span></div>{pending.length ? pending.map((match) => <article className="provider-request-row" key={match.request_id}><div><span>{cat(match.category)}</span><h3>{match.description}</h3><p>{match.postcode} · {timing(match.preferred_timing)}</p></div><ProviderAcceptButton requestId={match.request_id} /></article>) : <div className="dashboard-empty">{p.noNewRequests}</div>}</div>
      <div className="dashboard-section"><div className="dashboard-section-head"><h2>{p.leads}</h2><span>{leadCount}</span></div>{leads.length ? leads.map((lead) => lead.status === 'locked' ? <article className="lead-row lead-locked" key={lead.id}><div className="lead-row-copy"><span>{cat(lead.category)}</span><h3>{b.leads.lockedTitle}</h3><p>{b.leads.lockedText} · {new Date(lead.created_at).toLocaleDateString(dateLocale(lang))}</p></div><div className="lead-row-actions"><a className="dashboard-side-link" href={whatsappHref(b.leads.upgradeMessage(business.name))} target="_blank" rel="noopener noreferrer">{b.leads.upgrade} <ArrowRight aria-hidden="true" /></a></div></article> : <article className="lead-row" key={lead.id}><div className="lead-row-copy"><span>{cat(lead.category)}</span><h3>{lead.description || p.localRequest}</h3><p>{lead.postcode || t.common.town} · {new Date(lead.created_at).toLocaleDateString(dateLocale(lang))}</p></div><div className="lead-row-actions"><span className={`lead-pill lead-${lead.status}`}>{statusLabel(t, lead.status)}</span>{lead.status === 'new' ? <LeadStatusButton leadId={lead.id} status={lead.status} nextStatus="viewed" label={p.actView} /> : null}{lead.status === 'viewed' ? <LeadStatusButton leadId={lead.id} status={lead.status} nextStatus="accepted" label={p.actAccept} /> : null}{lead.status === 'accepted' ? <LeadStatusButton leadId={lead.id} status={lead.status} nextStatus="contacted" label={p.actContacted} /> : null}{lead.status === 'contacted' ? <LeadStatusButton leadId={lead.id} status={lead.status} nextStatus="converted" label={p.actWon} /> : null}</div></article>) : <div className="dashboard-empty">{p.noLeads}</div>}</div>
      <div className="dashboard-section"><div className="dashboard-section-head"><h2>{t.account.conversations}</h2><span>{conversations?.length || 0}</span></div>{conversations?.length ? conversations.map((conversation) => <a className="conversation-row" href={L(`/messages/${conversation.id}`)} key={conversation.id}><MessageCircle aria-hidden="true" /><div><strong>{cat(conversation.category)}</strong><small>{conversation.description || p.customerConversation}</small></div><span>{statusLabel(t, conversation.status)}</span><ArrowRight aria-hidden="true" /></a>) : <div className="dashboard-empty">{p.noConversations}</div>}</div>
    </div>
    <aside className="dashboard-side"><div className="dashboard-section"><div className="dashboard-section-head"><h2>{p.yourPlan}</h2>{PRICING_ENABLED ? <CreditCard aria-hidden="true" /> : <Check aria-hidden="true" />}</div>{PRICING_ENABLED ? <><div className="plan-summary"><strong>{activePlan.name}</strong><span>€{activePlan.monthly_price_cents ? (activePlan.monthly_price_cents / 100).toFixed(0) : '0'} {p.perMonth}</span><small>{p.included(activePlan.included_leads)} · {activePlan.featured ? p.promoIncluded : p.basicProfile}</small></div><a className="dashboard-side-link" href={L(`/voor-bedrijven${BUSINESS_OFFER_ANCHOR}`)}>{p.upgrade} <ArrowRight aria-hidden="true" /></a></> : <div className="plan-summary"><strong>{p.freePlan}</strong><span>{p.unlimited}</span><small>{p.noCosts}</small></div>}<a className="dashboard-side-link" href={L('/account/settings')}>{b.auth.settings} <ArrowRight aria-hidden="true" /></a></div>
      <div className="dashboard-section"><div className="dashboard-section-head"><h2>{p.whatYouGet}</h2><Sparkles aria-hidden="true" /></div><ul className="benefit-list">{p.benefits.map((benefit) => <li key={benefit}><Check aria-hidden="true" /> {benefit}</li>)}</ul></div>
      <div className="dashboard-section"><div className="dashboard-section-head"><h2>{t.account.notifications}</h2><BarChart3 aria-hidden="true" /></div>{notifications?.length ? notifications.map(n => <div className="notification-row" key={n.id}><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString(dateLocale(lang))}</small></div>) : <div className="dashboard-empty">{t.account.noNotifications}</div>}</div>
    </aside></section></div></main></div>;
}
