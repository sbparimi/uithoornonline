'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Phone, XCircle } from 'lucide-react';
import { useLang } from './lang-context';

type Result = { ok: true; already: boolean; businessName: string; conversationId: string | null; contact: { name: string; phone: string | null; email: string } };

// The one-tap accept button on /klus/<token>. A POST (never the link itself) accepts, so mail
// scanners that open links cannot take jobs.
export default function UrgentAccept({ token, businessName }: { token: string; businessName: string }) {
  const lang = useLang();
  const en = lang === 'en';
  const [state, setState] = useState<'idle' | 'busy' | 'won' | 'taken' | 'gone' | 'error'>('idle');
  const [res, setRes] = useState<Result | null>(null);
  async function accept() {
    setState('busy');
    try {
      const r = await fetch('/api/alerts/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: token }) });
      const data = await r.json().catch(() => ({}));
      if (r.ok) { setRes(data); setState('won'); return; }
      setState(data.error === 'taken' ? 'taken' : r.status === 429 ? 'error' : 'gone');
    } catch { setState('error'); }
  }
  if (state === 'won' && res) return <div className="ui-won-box" role="status"><CheckCircle2 aria-hidden="true" />
    <h2>{en ? `The job is yours, ${res.businessName}!` : `De klus is van jou, ${res.businessName}!`}</h2>
    <p>{en ? 'Contact the customer as soon as possible. These details are also in your email.' : 'Neem zo snel mogelijk contact op met de klant. Deze gegevens staan ook in je e-mail.'}</p>
    <dl><div><dt>{en ? 'Customer' : 'Klant'}</dt><dd>{res.contact.name || '–'}</dd></div><div><dt>{en ? 'Phone' : 'Telefoon'}</dt><dd>{res.contact.phone ? <a href={`tel:${res.contact.phone}`}>{res.contact.phone}</a> : '–'}</dd></div><div><dt>E-mail</dt><dd><a href={`mailto:${res.contact.email}`}>{res.contact.email}</a></dd></div></dl>
    {res.contact.phone ? <a className="primary platform-button-link" href={`tel:${res.contact.phone}`}><Phone aria-hidden="true" /> {en ? 'Call the customer' : 'Bel de klant'}</a> : null}
  </div>;
  if (state === 'taken') return <div className="ui-lost-box" role="status"><XCircle aria-hidden="true" /><h2>{en ? 'Just missed it' : 'Net te laat'}</h2><p>{en ? 'Another business accepted this job first. Thanks for responding so quickly!' : 'Een ander bedrijf was je net voor. Bedankt voor je snelle reactie!'}</p></div>;
  if (state === 'gone') return <div className="ui-lost-box" role="status"><XCircle aria-hidden="true" /><h2>{en ? 'No longer available' : 'Niet meer beschikbaar'}</h2><p>{en ? 'This job has been closed or the link has expired.' : 'Deze klus is gesloten of de link is verlopen.'}</p></div>;
  return <div className="ui-accept">
    <button className="primary ui-accept-btn" type="button" onClick={accept} disabled={state === 'busy'}>{state === 'busy' ? <Loader2 className="ui-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} {en ? `Accept this job for ${businessName}` : `Ik neem deze klus aan (${businessName})`}</button>
    <small>{en ? 'First to accept gets the job and the customer’s phone number. No login needed.' : 'Wie het eerst accepteert, krijgt de klus en het telefoonnummer van de klant. Inloggen is niet nodig.'}</small>
    {state === 'error' ? <p className="platform-error" role="alert">{en ? 'Something went wrong, try again.' : 'Er ging iets mis, probeer het opnieuw.'}</p> : null}
  </div>;
}
