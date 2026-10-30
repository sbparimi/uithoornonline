import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Eye, Globe, Mail, MessageCircle, MessageSquare, Phone, Sparkles, Trophy, Inbox } from 'lucide-react';
import { getCurrentUser } from '../../../../lib/auth/session';
import { getOwnBusiness } from '../../../../lib/data/businesses';
import { getOwnExtras } from '../../../../lib/ai-business/profile';
import { computeReport, currentPeriod, monthName, previousPeriod, recentChatLeads, validPeriod } from '../../../../lib/ai-business/report';
import { hasAnyHours } from '../../../../lib/hours';
import { AppHeader } from '../../../../components/app-header';
import { ReportToggle } from '../../../../components/ai-business/report-toggle';
import { dateLocale, isLocale, lp, type Locale } from '../../../../lib/i18n/config';
import { getDictionary } from '../../../../lib/i18n/dictionaries';
import '../../../ai-business.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === 'en' ? 'Your leads' : 'Jouw leads', robots: { index: false, follow: false } };
}

export default async function LeadsPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const en = lang === 'en';
  const L = (nl: string, e: string) => (en ? e : nl);
  const t = getDictionary(lang);
  const user = await getCurrentUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, '/provider/leads'))}`);
  const business = await getOwnBusiness(user);
  if (!business) redirect(lp(lang, user.role === 'admin' ? '/admin' : '/signup/account?role=provider'));
  const now = currentPeriod();
  const wanted = typeof sp.maand === 'string' && validPeriod(sp.maand) && sp.maand <= now ? sp.maand : now;
  const months = [now]; for (let i = 0; i < 5; i++) months.push(previousPeriod(months[months.length - 1]));
  const [r, prev, chats, extras] = await Promise.all([computeReport(business.id, wanted), computeReport(business.id, previousPeriod(wanted)), recentChatLeads(business.id), getOwnExtras(user)]);
  const diff = (a: number, b: number) => (a === b || (!a && !b) ? null : <small className={a > b ? 'up' : 'down'}>{a > b ? '▲' : '▼'} {Math.abs(a - b)}</small>);
  const card = (icon: React.ReactNode, label: string, value: number, before: number, sub?: string) => <div className="aib-metric">{icon}<span>{label}</span><strong>{value}{diff(value, before)}</strong>{sub && <em>{sub}</em>}</div>;
  const incomplete = !extras || (!hasAnyHours(extras.opening_hours) && !extras.faqs.length);

  return <div className="ds-page"><AppHeader links={[[lp(lang, '/provider'), t.common.backToDashboard], [lp(lang, '/provider/profile'), t.provider.profileNav]]} /><main id="main" className="platform-shell ds-platform"><div className="platform-dashboard aib-leads">
    <div className="platform-dashboard-head"><div><span className="uo-kicker">{business.name}</span><h1>{L('Jouw leads', 'Your leads')}</h1><p>{L('Wat Uithoorn.online deze maand voor je deed: hoe vaak je pagina bekeken werd, hoe vaak mensen belden, je website bezochten, een vraag stelden of je een klus stuurden.', 'What Uithoorn.online did for you this month: how often your page was viewed and how often people called, visited your website, asked a question or sent you a job.')}</p></div></div>
    <nav className="aib-months" aria-label={L('Maand', 'Month')}>{months.map((m) => <a key={m} href={`${lp(lang, '/provider/leads')}${m === now ? '' : `?maand=${m}`}`} aria-current={m === wanted ? 'page' : undefined}>{monthName(m, lang)}</a>)}</nav>
    <div className="aib-total"><span>{L(`Totaal contact in ${monthName(wanted, lang)}`, `Total contacts in ${monthName(wanted, lang)}`)}</span><strong>{r.total}</strong>{diff(r.total, prev.total)}<p>{L('Bellen + website + WhatsApp + vragen via de AI-assistent + klusaanvragen. ▲▼ = verschil met de maand ervoor.', 'Calls + website + WhatsApp + AI assistant questions + job requests. ▲▼ = change from the month before.')}</p></div>
    <div className="aib-metrics">
      {card(<Eye aria-hidden="true" />, L('Pagina bekeken', 'Page views'), r.views, prev.views)}
      {card(<Phone aria-hidden="true" />, L('Op "Bellen" getikt', 'Tapped "Call"'), r.phone, prev.phone)}
      {card(<Globe aria-hidden="true" />, L('Naar je website', 'To your website'), r.website, prev.website)}
      {card(<MessageCircle aria-hidden="true" />, 'WhatsApp', r.whatsapp, prev.whatsapp)}
      {card(<MessageSquare aria-hidden="true" />, L('Vragen via AI-assistent', 'AI assistant questions'), r.chatLeads, prev.chatLeads, L(`${r.chatOpens} gesprekken`, `${r.chatOpens} conversations`))}
      {card(<Inbox aria-hidden="true" />, L('Klusaanvragen voor jou', 'Job requests for you'), r.requests, prev.requests)}
      {card(<Trophy aria-hidden="true" />, L('Klussen aangenomen', 'Jobs accepted'), r.accepted, prev.accepted)}
    </div>
    {incomplete && <section className="aib-banner"><Sparkles aria-hidden="true" /><div><strong>{L('Krijg meer leads met een compleet profiel', 'Get more leads with a complete profile')}</strong><p>{L('Met openingstijden verschijn je bij "Nu open", en met veelgestelde vragen kan de AI-assistent bezoekers 24/7 helpen. AI vult het in 2 minuten in.', 'With opening hours you appear under "Open now", and with FAQs the AI assistant can help visitors 24/7. AI fills it in in 2 minutes.')}</p></div><a className="aib-btn aib-btn-primary" href={lp(lang, '/provider/profile')}>{L('Maak mijn profiel met AI', 'Build my profile with AI')}</a></section>}
    <section className="dashboard-section aib-chatleads"><div className="dashboard-section-head"><h2>{L('Vragen via de AI-assistent', 'Questions via the AI assistant')}</h2><span>{chats.length}</span></div>
      {chats.length ? chats.map((c) => <article key={c.id} className="aib-chatlead"><div><strong>{c.name}</strong><small>{new Date(c.created_at).toLocaleString(dateLocale(lang), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam' })}</small></div><p>{c.question}</p><div className="aib-chatlead-actions">{c.email && <a className="aib-btn" href={`mailto:${c.email}?subject=${encodeURIComponent(L('Je vraag via Uithoorn.online', 'Your question via Uithoorn.online'))}`}><Mail aria-hidden="true" /> {c.email}</a>}{c.phone && <a className="aib-btn" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}><Phone aria-hidden="true" /> {c.phone}</a>}</div></article>)
        : <div className="dashboard-empty">{L('Nog geen vragen. Zodra een bezoeker via de AI-assistent op je pagina een vraag achterlaat, zie je die hier en krijg je een e-mail.', 'No questions yet. When a visitor leaves a question through the AI assistant on your page, you see it here and get an email.')}</div>}
    </section>
    <ReportToggle initial={extras?.report_email ?? true} lang={lang} />
    <p className="aib-hint">{L('Tellingen zijn anoniem (geen cookies, geen IP-adressen) en zonder bots. Klusaanvragen en aangenomen klussen komen uit "Hulp aanvragen" en spoedmeldingen.', 'Counts are anonymous (no cookies, no IP addresses) and exclude bots. Job requests and accepted jobs come from "Request help" and urgent alerts.')}</p>
  </div></main></div>;
}
