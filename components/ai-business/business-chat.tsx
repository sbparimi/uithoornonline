'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Check, Loader2, Send, Sparkles } from 'lucide-react';
import { useSpamTrap } from '../spam-trap';

type Turn = { role: 'user' | 'assistant'; content: string };
type Props = { businessId: string; businessName: string; lang: 'nl' | 'en'; suggestions: string[] };

// "Stel een vraag": AI assistant on a business page. Clearly labelled as AI, answers only from the
// business's own profile; for anything it can't answer (or a quote / appointment) it offers to pass the
// question on: name + email or phone -> lead for the business.
export function BusinessChat({ businessId, businessName, lang, suggestions }: Props) {
  const en = lang === 'en';
  const L = (nl: string, e: string) => (en ? e : nl);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [lead, setLead] = useState({ name: '', contact: '', question: '', consent: false });
  const [leadState, setLeadState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [leadError, setLeadError] = useState('');
  const { fields, trap } = useSpamTrap();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [turns, showLead, busy]);

  async function ask(text: string) {
    const q = text.trim().slice(0, 400);
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content: q }];
    setTurns(next); setInput(''); setBusy(true);
    try {
      const res = await fetch('/api/business-chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, lang, messages: next }), signal: AbortSignal.timeout(20000) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'failed');
      setTurns([...next, { role: 'assistant', content: String(data.reply || '') }]);
      if (data.intent === 'lead' || data.intent === 'unknown') { setShowLead(true); setLead((l) => ({ ...l, question: l.question || q })); }
    } catch (e) {
      const limited = e instanceof Error && e.message === 'rate_limited';
      setTurns([...next, { role: 'assistant', content: limited ? L('Even rustig aan: probeer het over een paar minuten opnieuw, of laat hieronder je vraag achter.', 'Slow down a little: try again in a few minutes, or leave your question below.') : L('Dat lukte even niet. Laat je vraag hieronder achter, dan stuur ik hem door naar het bedrijf.', "That didn't work just now. Leave your question below and I'll pass it on to the business.") }]);
      setShowLead(true); setLead((l) => ({ ...l, question: l.question || q }));
    } finally { setBusy(false); }
  }

  async function sendLead(e: FormEvent) {
    e.preventDefault();
    if (leadState === 'sending') return;
    const c = lead.contact.trim();
    const isMail = c.includes('@');
    setLeadState('sending'); setLeadError('');
    try {
      const res = await fetch('/api/business-chat/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, lang, name: lead.name, email: isMail ? c : '', phone: isMail ? '' : c, question: lead.question, consent: lead.consent, messages: turns, ...fields }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLeadState('error');
        setLeadError(data.error === 'invalid_email' ? L('Dat e-mailadres klopt niet.', 'That email address looks wrong.') : data.error === 'invalid_phone' ? L('Dat telefoonnummer klopt niet.', 'That phone number looks wrong.') : data.error === 'contact_required' ? L('Vul je e-mail of telefoonnummer in.', 'Enter your email or phone number.') : data.error === 'consent_required' ? L('Vink het vakje aan, dan mogen we je gegevens doorsturen.', 'Tick the box so we may pass your details on.') : data.error === 'rate_limited' ? L('Te veel berichten, probeer het later opnieuw.', 'Too many messages, try again later.') : L('Versturen lukte niet. Probeer het opnieuw.', "Sending failed. Please try again."));
        return;
      }
      setLeadState('sent');
      setTurns((t) => [...t, { role: 'assistant', content: L(`Verstuurd. ${businessName} neemt zelf contact met je op.`, `Sent. ${businessName} will get back to you directly.`) }]);
    } catch { setLeadState('error'); setLeadError(L('Versturen lukte niet. Probeer het opnieuw.', 'Sending failed. Please try again.')); }
  }

  return (
    <section className="aib-chat" id="vraag" aria-labelledby="aib-chat-title">
      <div className="aib-chat-head">
        <span className="aib-chat-avatar" aria-hidden="true"><Bot /></span>
        <div>
          <h2 id="aib-chat-title">{L('Stel een vraag', 'Ask a question')}</h2>
          <p><Sparkles aria-hidden="true" /> {L(`AI-assistent · antwoordt alleen met informatie van ${businessName}`, `AI assistant · answers only with information from ${businessName}`)}</p>
        </div>
      </div>
      <div className="aib-chat-log" ref={listRef} aria-live="polite">
        {!turns.length && <p className="aib-chat-hello">{L(`Hoi! Vraag me iets over ${businessName}: openingstijden, diensten, waar ze zitten… Weet ik het niet, dan stuur ik je vraag door.`, `Hi! Ask me anything about ${businessName}: opening hours, services, where they are… If I don't know, I'll pass your question on.`)}</p>}
        {turns.map((t, i) => <div key={i} className={`aib-msg aib-msg-${t.role}`}>{t.content}</div>)}
        {busy && <div className="aib-msg aib-msg-assistant aib-typing"><Loader2 aria-hidden="true" className="aib-spin" /> {L('Even kijken…', 'Checking…')}</div>}
      </div>
      {!turns.length && suggestions.length > 0 && (
        <div className="aib-chat-suggest">{suggestions.slice(0, 3).map((s) => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}</div>
      )}
      {showLead && leadState !== 'sent' && (
        <form className="aib-lead" onSubmit={sendLead}>
          <h3>{L(`Vraag doorsturen naar ${businessName}`, `Send your question to ${businessName}`)}</h3>
          {trap}
          <label>{L('Je naam', 'Your name')}<input required minLength={2} maxLength={120} autoComplete="name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} /></label>
          <label>{L('E-mail of telefoon', 'Email or phone')}<input required maxLength={254} autoComplete="email" inputMode="email" placeholder={L('naam@voorbeeld.nl of 06…', 'name@example.com or 06…')} value={lead.contact} onChange={(e) => setLead({ ...lead, contact: e.target.value })} /></label>
          <label>{L('Je vraag', 'Your question')}<textarea required minLength={3} maxLength={2000} rows={3} value={lead.question} onChange={(e) => setLead({ ...lead, question: e.target.value })} /></label>
          <label className="aib-check"><input type="checkbox" checked={lead.consent} onChange={(e) => setLead({ ...lead, consent: e.target.checked })} /><span>{L(`${businessName} mag mijn naam, contactgegeven en vraag ontvangen om te reageren.`, `${businessName} may receive my name, contact detail and question to reply.`)}</span></label>
          {leadError && <p className="aib-error" role="alert">{leadError}</p>}
          <button className="aib-btn aib-btn-primary" type="submit" disabled={leadState === 'sending'}>{leadState === 'sending' ? <Loader2 aria-hidden="true" className="aib-spin" /> : <Send aria-hidden="true" />} {L('Verstuur vraag', 'Send question')}</button>
        </form>
      )}
      {leadState === 'sent' && <p className="aib-sent" role="status"><Check aria-hidden="true" /> {L('Je vraag is doorgestuurd.', 'Your question was sent.')}</p>}
      <form className="aib-chat-input" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={400} placeholder={L('Typ je vraag…', 'Type your question…')} aria-label={L('Je vraag', 'Your question')} enterKeyHint="send" />
        <button type="submit" className="aib-btn aib-btn-primary" disabled={busy || !input.trim()} aria-label={L('Verstuur', 'Send')}><Send aria-hidden="true" /></button>
      </form>
      {!showLead && turns.length > 0 && <button type="button" className="aib-link" onClick={() => { setShowLead(true); setLead((l) => ({ ...l, question: l.question || turns.filter((t) => t.role === 'user').pop()?.content || '' })); }}>{L('Liever direct je vraag doorsturen?', 'Rather send your question directly?')}</button>}
    </section>
  );
}
