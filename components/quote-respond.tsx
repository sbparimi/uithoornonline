'use client';

import { useState } from 'react';
import { CheckCircle2, Euro, Loader2, Phone, Send, XCircle } from 'lucide-react';
import { useLang } from './lang-context';

// A business answers a quote request on /klus/<token> (AI request flow, docs/AI_REQUESTS.md): amount
// (or "after a visit"), a message and when it can start. No login: the signed token names request +
// business. Once the customer chooses this quote, the contact details show here and the business can
// mark the job done (which sends the customer a verified review request).
type Existing = { amountCents: number | null; priceType: string; message: string; availableFrom: string | null; status: string } | null;
type Contact = { name: string; phone: string | null; email: string } | null;

export default function QuoteRespond({ token, businessName, existing, declined, chosen, chosenOther, completed, contact, suggestion }: {
  token: string; businessName: string; existing: Existing; declined: boolean; chosen: boolean; chosenOther: boolean; completed: boolean; contact: Contact; suggestion: string;
}) {
  const lang = useLang();
  const en = lang === 'en';
  const today = new Date().toISOString().slice(0, 10);
  const [priceType, setPriceType] = useState(existing?.priceType ?? 'fixed');
  const [amount, setAmount] = useState(existing?.amountCents != null ? String(existing.amountCents / 100).replace('.', ',') : '');
  const [message, setMessage] = useState(existing?.message ?? '');
  const [date, setDate] = useState(existing?.availableFrom ?? '');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'declined' | 'done' | 'closed' | 'error'>(declined ? 'declined' : 'idle');
  const [err, setErr] = useState('');
  const draft = en
    ? `Hi, thanks for your request. Based on your description I can do this job${amount ? ` for the price above` : ''}. ${suggestion ? 'I would like to check a few details with you first. ' : ''}Kind regards, ${businessName}`
    : `Hallo, bedankt voor je aanvraag. Op basis van je beschrijving kan ik deze klus voor je doen${amount ? ' voor de prijs hierboven' : ''}. ${suggestion ? 'Ik stem graag nog een paar details met je af. ' : ''}Groet, ${businessName}`;

  async function post(body: Record<string, unknown>, url = '/api/quotes') {
    setErr('');
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: token, ...body }) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, error: String(d.error ?? '') };
  }
  async function send() {
    if (priceType !== 'visit' && !(Number(amount.replace(/\./g, '').replace(',', '.')) > 0)) { setErr(en ? 'Enter an amount, or choose "after a visit".' : 'Vul een bedrag in, of kies "na bezichtiging".'); return; }
    setState('busy');
    try {
      const r = await post({ action: 'quote', priceType, amount, message, availableFrom: date || null });
      if (r.ok) setState('sent'); else { setState(r.error === 'closed' ? 'closed' : 'error'); if (r.error === 'invalid_amount') setErr(en ? 'That amount looks wrong.' : 'Dat bedrag klopt niet.'); }
    } catch { setState('error'); }
  }
  async function decline() {
    setState('busy');
    try { const r = await post({ action: 'decline' }); setState(r.ok ? 'declined' : 'error'); } catch { setState('error'); }
  }
  async function done() {
    setState('busy');
    try { const r = await post({}, '/api/jobs/done'); setState(r.ok ? 'done' : 'error'); } catch { setState('error'); }
  }

  if (chosenOther) return <div className="ui-lost-box" role="status"><XCircle aria-hidden="true" /><h2>{en ? 'The customer chose another business' : 'De klant heeft een ander bedrijf gekozen'}</h2><p>{en ? 'Thanks for your quote. Good reviews help you get chosen more often.' : 'Bedankt voor je offerte. Goede beoordelingen helpen je om vaker gekozen te worden.'}</p></div>;
  if (chosen && contact) return <div className="ui-won-box" role="status"><CheckCircle2 aria-hidden="true" />
    <h2>{en ? `The customer chose you, ${businessName}!` : `De klant heeft voor jou gekozen, ${businessName}!`}</h2>
    <p>{en ? 'Contact the customer to plan the job. These details are also in your email.' : 'Neem contact op met de klant om de klus in te plannen. Deze gegevens staan ook in je e-mail.'}</p>
    <dl><div><dt>{en ? 'Customer' : 'Klant'}</dt><dd>{contact.name || '–'}</dd></div><div><dt>{en ? 'Phone' : 'Telefoon'}</dt><dd>{contact.phone ? <a href={`tel:${contact.phone}`}>{contact.phone}</a> : '–'}</dd></div><div><dt>E-mail</dt><dd><a href={`mailto:${contact.email}`}>{contact.email}</a></dd></div></dl>
    {contact.phone ? <a className="primary platform-button-link" href={`tel:${contact.phone}`}><Phone aria-hidden="true" /> {en ? 'Call the customer' : 'Bel de klant'}</a> : null}
    {completed || state === 'done'
      ? <p className="ui-muted"><CheckCircle2 aria-hidden="true" className="ui-inline-icon" /> {en ? 'Marked as done. We asked the customer for a review.' : 'Gemarkeerd als klaar. We hebben de klant om een beoordeling gevraagd.'}</p>
      : <div className="ui-after ui-done-ask"><span>{en ? 'Finished the job?' : 'Klus afgerond?'}</span><button type="button" className="ui-ghost" disabled={state === 'busy'} onClick={done}>{state === 'busy' ? <Loader2 className="ui-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} {en ? 'Mark as done' : 'Markeer als klaar'}</button></div>}
    <small className="ui-muted">{en ? 'The customer then gets a review request. Reviews from real jobs help you rank higher.' : 'De klant krijgt dan een verzoek om een beoordeling. Beoordelingen van echte klussen laten je hoger staan.'}</small>
  </div>;
  if (completed || state === 'closed') return <div className="ui-lost-box"><h2>{en ? 'Closed' : 'Gesloten'}</h2></div>;
  if (state === 'declined') return <div className="ui-lost-box" role="status"><h2>{en ? 'Got it, we asked another business' : 'Duidelijk, we vragen een ander bedrijf'}</h2><p>{en ? 'Thanks for letting us know.' : 'Bedankt dat je het liet weten.'}</p></div>;
  if (state === 'sent') return <div className="ui-won-box" role="status"><Send aria-hidden="true" /><h2>{existing ? (en ? 'Quote updated' : 'Offerte bijgewerkt') : (en ? 'Quote sent!' : 'Offerte verstuurd!')}</h2><p>{en ? 'The customer compares the quotes and chooses. You get an email with their contact details if they choose you.' : 'De klant vergelijkt de offertes en kiest. Je krijgt een e-mail met de contactgegevens als de klant voor jou kiest.'}</p><button type="button" className="ui-ghost" onClick={() => setState('idle')}>{en ? 'Edit my quote' : 'Offerte aanpassen'}</button></div>;

  return <div className="ui-quote-form">
    <h2>{existing ? (en ? 'Your quote' : 'Jouw offerte') : (en ? 'Send a quote' : 'Stuur een offerte')}</h2>
    <div className="ui-price-types" role="radiogroup" aria-label={en ? 'Price type' : 'Soort prijs'}>
      {([['fixed', en ? 'Fixed price' : 'Vaste prijs'], ['from', en ? 'From' : 'Vanaf'], ['hourly', en ? 'Per hour' : 'Per uur'], ['visit', en ? 'After a visit' : 'Na bezichtiging']] as const).map(([v, l]) =>
        <button key={v} type="button" role="radio" aria-checked={priceType === v} className={`ui-chip${priceType === v ? ' on' : ''}`} onClick={() => setPriceType(v)}>{l}</button>)}
    </div>
    {priceType !== 'visit' ? <label className="ui-amount"><span>{en ? 'Amount incl. VAT' : 'Bedrag incl. btw'}</span><span className="ui-amount-field"><Euro aria-hidden="true" /><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={suggestion || '0'} aria-label={en ? 'Amount in euros' : 'Bedrag in euro'} /></span></label> : null}
    <label><span>{en ? 'Can start from' : 'Kan starten vanaf'}</span><input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
    <label><span>{en ? 'Message to the customer' : 'Bericht aan de klant'}</span><textarea rows={4} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={en ? 'What is included, how you work, any questions…' : 'Wat zit erbij, hoe je werkt, eventuele vragen…'} /></label>
    {!message ? <button type="button" className="ui-link-btn" onClick={() => setMessage(draft)}>{en ? 'Fill in an example text (edit it yourself)' : 'Vul een voorbeeldtekst in (pas hem zelf aan)'}</button> : null}
    <div className="ui-row">
      <button type="button" className="ui-ghost" disabled={state === 'busy'} onClick={decline}>{en ? 'Not available' : 'Niet beschikbaar'}</button>
      <button type="button" className="primary" disabled={state === 'busy'} onClick={send}>{state === 'busy' ? <Loader2 className="ui-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} {existing ? (en ? 'Update quote' : 'Offerte bijwerken') : (en ? 'Send quote' : 'Verstuur offerte')}</button>
    </div>
    <small className="ui-muted">{en ? 'The customer sees your business name, rating, price, start date and message. You get their contact details once they choose you.' : 'De klant ziet je bedrijfsnaam, beoordeling, prijs, startdatum en bericht. Je krijgt de contactgegevens zodra de klant voor jou kiest.'}</small>
    {err ? <p className="platform-error" role="alert">{err}</p> : null}
    {state === 'error' && !err ? <p className="platform-error" role="alert">{en ? 'Something went wrong, try again.' : 'Er ging iets mis, probeer het opnieuw.'}</p> : null}
  </div>;
}
