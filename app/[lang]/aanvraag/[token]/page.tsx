import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../../urgent.css';
import { SiteHeader } from '../../../../components/site-header';
import { SiteFooter } from '../../../../components/site-footer';
import { LeadAccept } from '../../../../components/lead-accept';
import { isLocale, lp, type Locale } from '../../../../lib/i18n/config';
import { queryOne } from '../../../../lib/db';
import { verifyToken } from '../../../../lib/urgent/tokens';
import { getDictionary } from '../../../../lib/i18n/dictionaries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Aanvraag · Uithoorn.online', robots: { index: false, follow: false } };

// Landing page of an instant lead alert (lib/leads/instant.ts). Shows the request without the
// customer's contact details; one tap responds (same as accepting on the dashboard).
export default async function LeadPage({ params }: { params: Promise<{ lang: string; token: string }> }) {
  const { lang: raw, token: rawToken } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const en = lang === 'en';
  const token = decodeURIComponent(rawToken);
  const ids = verifyToken('lead', token);
  if (!ids) notFound();
  const r = await queryOne<{ id: string; category: string; description: string; postcode: string; preferred_timing: string | null; created_at: string; status: string; hidden: boolean; budget_min: string | null; budget_max: string | null }>(
    `select id, category, description, postcode, preferred_timing, created_at, status, hidden, budget_min::text, budget_max::text from service_requests where id = $1`, [ids[0]]);
  const biz = await queryOne<{ name: string }>('select name from businesses where id = $1', [ids[1]]);
  if (!r || !biz || r.hidden) notFound();
  const lead = await queryOne<{ status: string; conversation_id: string | null }>(
    `select l.status, c.id as conversation_id from leads l left join conversations c on c.request_id = l.request_id and c.business_id = l.business_id where l.request_id = $1 and l.business_id = $2`, [ids[0], ids[1]]);
  const t = getDictionary(lang);
  const cat = (t.requestForm.categories as Record<string, string>)[r.category] ?? r.category;
  const when = r.preferred_timing ? ((t.requestForm.timing as Record<string, string>)[r.preferred_timing] ?? r.preferred_timing) : '—';
  const time = new Date(r.created_at).toLocaleString(en ? 'en-GB' : 'nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const budget = r.budget_min || r.budget_max ? `€ ${[r.budget_min, r.budget_max].filter(Boolean).map((v) => Math.round(Number(v))).join(' – ')}` : null;
  const closed = ['completed', 'cancelled', 'expired'].includes(r.status) || lead?.status === 'closed' || lead?.status === 'declined';
  const conversationHref = lp(lang, '/messages/__ID__'); // signs in first when needed
  return <div className="ds-page"><SiteHeader /><main id="main" className="uo-easy-home ui-page"><section className="ui-hero ui-hero-single"><div className="ui-card ui-job">
    <p className="ds-eyebrow"><span aria-hidden="true" />{en ? 'New request' : 'Nieuwe aanvraag'} · {biz.name}</p>
    <h1>{cat} <em>{r.postcode.slice(0, 4)}</em></h1>
    <dl className="ui-job-facts">
      <div><dt>{en ? 'When' : 'Wanneer'}</dt><dd>{when}</dd></div>
      <div><dt>{en ? 'Posted' : 'Geplaatst'}</dt><dd>{time}</dd></div>
      <div><dt>{en ? 'Area' : 'Gebied'}</dt><dd>{r.postcode.slice(0, 4)} (Uithoorn e.o.)</dd></div>
      {budget ? <div><dt>{en ? 'Budget' : 'Budget'}</dt><dd>{budget}</dd></div> : null}
    </dl>
    <blockquote className="ui-job-desc">{r.description}</blockquote>
    {closed
      ? <div className="ui-lost-box" role="status"><h2>{en ? 'No longer available' : 'Niet meer beschikbaar'}</h2><p>{en ? 'This request has been closed.' : 'Deze aanvraag is gesloten.'}</p></div>
      : <LeadAccept token={token} lang={lang} already={lead?.status === 'accepted' ? (lead.conversation_id ?? '') : null} conversationHref={conversationHref} />}
  </div></section></main><SiteFooter lang={lang} /></div>;
}
