"use client";

import { useState } from 'react';
import { ArrowRight, Check, MessageCircle } from 'lucide-react';

// The one-tap button on /aanvraag/<token>. POST only (mail scanners prefetch links with GET).
export function LeadAccept({ token, lang, already, conversationHref }: { token: string; lang: 'nl' | 'en'; already: string | null; conversationHref: string }) {
  const en = lang === 'en';
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error' | 'gone'>(already ? 'done' : 'idle');
  const [conv, setConv] = useState<string | null>(already);
  async function go() {
    setState('busy');
    const res = await fetch('/api/leads/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token }) }).catch(() => null);
    if (res && res.ok) { const j = await res.json(); setConv(j.conversationId); setState('done'); return; }
    setState(res && (res.status === 410 || res.status === 404) ? 'gone' : 'error');
  }
  const href = conv ? conversationHref.replace('__ID__', conv) : conversationHref;
  if (state === 'done') return (
    <div className="ui-won-box lead-done" role="status">
      <Check aria-hidden="true" /><h2>{en ? 'You responded' : 'Je hebt gereageerd'}</h2>
      <p>{en ? 'The customer has been told you want to help. Open the conversation to send a message, ask a question or propose a time.' : 'De klant weet nu dat je wilt helpen. Open het gesprek om een bericht te sturen, iets te vragen of een tijd voor te stellen.'}</p>
      <a className="primary platform-button-link" href={href}><MessageCircle aria-hidden="true" /> {en ? 'Open the conversation' : 'Open het gesprek'} <ArrowRight aria-hidden="true" /></a>
    </div>
  );
  if (state === 'gone') return <div className="ui-lost-box" role="status"><h2>{en ? 'No longer available' : 'Niet meer beschikbaar'}</h2><p>{en ? 'This request has been closed or taken.' : 'Deze aanvraag is gesloten of al vergeven.'}</p></div>;
  return (
    <div className="ui-accept">
      <button type="button" className="primary ui-accept-btn" onClick={go} disabled={state === 'busy'}>{state === 'busy' ? (en ? 'One moment…' : 'Even geduld…') : (en ? 'I’ll respond to this request' : 'Ik reageer op deze aanvraag')} <ArrowRight aria-hidden="true" /></button>
      {state === 'error' && <p className="platform-error" role="alert">{en ? 'That did not work. Please try again.' : 'Dat lukte niet. Probeer het nog eens.'}</p>}
      <small>{en ? 'The customer’s contact details are shared in the conversation once you respond. Not a fit? Do nothing.' : 'Na je reactie kunnen jullie in het gesprek contact hebben. Past het niet? Dan hoef je niets te doen.'}</small>
    </div>
  );
}
