import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import '../../../urgent.css';
import { SiteHeader } from '../../../../components/site-header';
import { SiteFooter } from '../../../../components/site-footer';
import UrgentAccept from '../../../../components/urgent-accept';
import QuoteRespond from '../../../../components/quote-respond';
import JobDoneButton from '../../../../components/job-done-button';
import { Sparkles } from 'lucide-react';
import { isLocale, type Locale } from '../../../../lib/i18n/config';
import { queryOne } from '../../../../lib/db';
import { signToken, verifyToken } from '../../../../lib/urgent/tokens';
import { categoryLabel, tickQuietly } from '../../../../lib/urgent/alerts';
import { urgencyLabel } from '../../../../lib/urgent/mail';
import { quoteView, roundsQuietly } from '../../../../lib/urgent/quotes';
import { priceText } from '../../../../lib/urgent/ai-request';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Klus · Uithoorn.online', robots: { index: false, follow: false } };

// Landing page of a job alert (email/SMS/WhatsApp). Shows the job without the customer's contact
// details; accepting (first wins) reveals them. No login: the signed token names request + business.
export default async function JobPage({ params }: { params: Promise<{ lang: string; token: string }> }) {
  const { lang: raw, token: rawToken } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const en = lang === 'en';
  const token = decodeURIComponent(rawToken);
  const ids = verifyToken('accept', token);
  if (!ids) notFound();
  after(tickQuietly);
  after(roundsQuietly);
  const r = await queryOne<{ id: string; category: string; description: string; postcode: string; urgency_level: string | null; created_at: string; accepted_business_id: string | null; status: string; hidden: boolean; summary: string | null; photos: number }>(
    `select r.id, r.category, r.description, r.postcode, r.urgency_level, r.created_at, r.accepted_business_id, r.status, r.hidden, r.intake->>'summary' as summary,
            (select count(*)::int from request_photos p where p.request_id = r.id) as photos from service_requests r where r.id = $1`, [ids[0]]);
  const biz = await queryOne<{ name: string }>('select name from businesses where id = $1', [ids[1]]);
  if (!r || !biz || r.hidden) notFound();
  const photoToken = r.photos ? signToken('photo', [r.id], 3) : '';
  const time = new Date(r.created_at).toLocaleString(en ? 'en-GB' : 'nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const takenByOther = r.accepted_business_id && r.accepted_business_id !== ids[1];
  const mine = r.accepted_business_id === ids[1];
  // AI request flow: quote requests show the AI job brief and a quote form instead of first-to-accept.
  const qv = await quoteView(r.id, ids[1], lang).catch(() => null);
  return <div className="ds-page"><SiteHeader /><main id="main" className="uo-easy-home ui-page"><section className="ui-hero ui-hero-single"><div className="ui-card ui-job">
    <p className="ds-eyebrow"><span aria-hidden="true" />{qv ? (en ? 'Quote request' : 'Offerteaanvraag') : r.urgency_level === 'spoed' ? (en ? 'Urgent job' : 'Spoedklus') : (en ? 'New job' : 'Nieuwe klus')} · {biz.name}</p>
    <h1>{categoryLabel(lang, r.category)} <em>{r.postcode.slice(0, 4)}</em></h1>
    <dl className="ui-job-facts">
      <div><dt>{en ? 'When' : 'Wanneer'}</dt><dd>{urgencyLabel(lang, r.urgency_level)}</dd></div>
      <div><dt>{en ? 'Posted' : 'Geplaatst'}</dt><dd>{time}</dd></div>
      <div><dt>{en ? 'Area' : 'Gebied'}</dt><dd>{r.postcode.slice(0, 4)} (Uithoorn e.o.)</dd></div>
    </dl>
    {qv ? <section className="ui-brief" aria-labelledby="brief-title">
      <h2 id="brief-title"><Sparkles aria-hidden="true" /> {en ? 'Job summary' : 'Samenvatting van de klus'} <span className="ui-ai-label">{en ? 'written by AI' : 'door AI gemaakt'}</span></h2>
      <p>{qv.brief.summary}</p>
      {qv.brief.facts.length ? <dl className="ui-brief-facts">{qv.brief.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : null}
      {qv.brief.price ? <p className="ui-brief-price"><strong>{en ? 'Indication' : 'Indicatie'}: {priceText(lang, qv.brief.price)}</strong> <span>({en ? 'AI estimate, not binding' : 'AI-schatting, niet bindend'}{qv.brief.price.basis ? `: ${qv.brief.price.basis}` : ''})</span></p> : null}
      {qv.brief.ask.length ? <div className="ui-brief-ask"><strong>{en ? 'Worth asking the customer' : 'Handig om nog te vragen'}</strong><ul>{qv.brief.ask.map((a) => <li key={a}>{a}</li>)}</ul></div> : null}
      <small className="ui-muted">{en ? 'Made from what the customer wrote; always check it yourself. The customer’s own words are below.' : 'Gemaakt op basis van wat de klant schreef; controleer het altijd zelf. De eigen woorden van de klant staan hieronder.'}</small>
    </section> : r.summary ? <p className="ui-job-summary"><strong>{r.summary}</strong></p> : null}
    <blockquote className="ui-job-desc">{r.description}</blockquote>
    {r.photos ? <div className="ui-job-photos">{Array.from({ length: Math.min(3, r.photos) }, (_, n) => <a key={n} href={`/api/urgent/photo?t=${encodeURIComponent(photoToken)}&n=${n}`} target="_blank"><img src={`/api/urgent/photo?t=${encodeURIComponent(photoToken)}&n=${n}`} alt={`${en ? 'Photo' : 'Foto'} ${n + 1}`} /></a>)}</div> : null}
    {qv ? <QuoteRespond token={token} businessName={biz.name} existing={qv.quote} declined={qv.declined} chosen={qv.chosen} chosenOther={qv.chosenOther} completed={qv.completed} contact={qv.contact} suggestion={qv.brief.price ? priceText(lang, qv.brief.price) : ''} />
    : takenByOther
      ? <div className="ui-lost-box" role="status"><h2>{en ? 'Already taken' : 'Al vergeven'}</h2><p>{en ? 'Another business accepted this job first.' : 'Een ander bedrijf heeft deze klus al aangenomen.'}</p></div>
      : ['completed', 'cancelled', 'expired'].includes(r.status) ? <div className="ui-lost-box"><h2>{en ? 'Closed' : 'Gesloten'}</h2></div>
      : <UrgentAccept token={token} businessName={biz.name} />}
    {!qv && mine && !['completed', 'cancelled', 'expired'].includes(r.status) ? <JobDoneButton token={token} /> : null}
    {!qv && mine ? <p className="ui-muted">{en ? 'You already accepted this job; press the button again to see the customer’s details.' : 'Je hebt deze klus al aangenomen; druk nog eens op de knop om de klantgegevens te zien.'}</p> : null}
  </div></section></main><SiteFooter lang={lang} /></div>;
}
