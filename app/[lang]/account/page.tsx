import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ArrowRight, Bell, MessageCircle } from 'lucide-react';
import { getCurrentUser } from '../../../lib/auth/session';
import { getResidentDashboard } from '../../../lib/data/dashboards';
import { getBackendDict } from '../../../lib/i18n/backend';
import { AppHeader } from '../../../components/app-header';
import { dateLocale, isLocale, lp, type Locale } from '../../../lib/i18n/config';
import { getDictionary, statusLabel } from '../../../lib/i18n/dictionaries';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const a = t.account;
  const user = await getCurrentUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, '/account'))}`);
  if (user.role === 'provider') redirect(lp(lang, '/provider'));
  const { requests, conversations, notifications } = await getResidentDashboard(user);
  const profile = { full_name: user.fullName };
  const b = getBackendDict(lang);
  const cat = (value?: string | null) => (value ? (t.requestForm.categories[value] ?? value) : t.common.request);
  const timing = (value?: string | null) => (value ? (t.requestForm.timing[value] ?? value) : '');
  return <div className="ds-page"><AppHeader links={[[lp(lang, '/request'), a.newRequest]]} /><main id="main" className="platform-shell ds-platform"><div className="platform-dashboard"><div className="platform-dashboard-head"><div><span className="uo-kicker">{a.kicker}</span><h1>{a.welcome(profile?.full_name)}</h1><p>{a.intro}</p></div><div className="platform-head-actions"><a className="primary platform-button-link" href={lp(lang, '/request')}>{a.newRequest} <ArrowRight aria-hidden="true" /></a><a className="platform-secondary-link" href={lp(lang, '/account/settings')}>{b.auth.settings}</a></div></div><section className="dashboard-grid"><div className="dashboard-main"><div className="dashboard-section"><div className="dashboard-section-head"><h2>{a.myRequests}</h2><span>{requests?.length || 0}</span></div>{requests?.length ? requests.map(request => <article className="request-row" key={request.id}><div><span>{cat(request.category)}</span><h3>{request.description}</h3><p>{request.postcode} · {timing(request.preferred_timing)}</p></div><strong>{statusLabel(t, request.status)}</strong></article>) : <div className="dashboard-empty">{a.noRequests} <a href={lp(lang, '/request')}>{a.firstRequest} <ArrowRight aria-hidden="true" /></a></div>}</div><div className="dashboard-section"><div className="dashboard-section-head"><h2>{a.conversations}</h2><span>{conversations?.length || 0}</span></div>{conversations?.length ? conversations.map((conversation: any) => <a className="conversation-row" href={lp(lang, `/messages/${conversation.id}`)} key={conversation.id}><MessageCircle aria-hidden="true" /><div><strong>{conversation.business_name || t.common.localProvider}</strong><small>{cat(conversation.category)}</small></div><span>{statusLabel(t, conversation.status)}</span><ArrowRight aria-hidden="true" /></a>) : <div className="dashboard-empty">{a.noConversations}</div>}</div></div><aside className="dashboard-side"><div className="dashboard-section"><div className="dashboard-section-head"><h2>{a.notifications}</h2><Bell aria-hidden="true" /></div>{notifications?.length ? notifications.map(notification => <div className={`notification-row ${notification.read_at ? 'read' : ''}`} key={notification.id}><strong>{notification.title}</strong><p>{notification.body}</p><small>{new Date(notification.created_at).toLocaleString(dateLocale(lang))}</small></div>) : <div className="dashboard-empty">{a.noNotifications}</div>}</div></aside></section></div></main></div>;
}
