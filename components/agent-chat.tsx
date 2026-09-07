'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, Minus, Phone, Send, Star, X } from 'lucide-react';

type Provider = { id: string; name: string; category: string; description: string; postcode: string | null; phone: string | null; website: string | null; verified: boolean; rating_score: number | null; rating_max: number | null; rating_review_count: number | null; rating_source: string | null; source_url?: string | null; external_source?: string | null };
type Action = { label: string; value: string; kind: 'quick_reply' | 'emergency' };
type Message = { id: number; role: 'assistant' | 'user'; text: string; actions?: Action[]; providers?: Provider[] };
type Contact = { name: string; email: string; phone: string; address: string };
type AgentResponse = { providers: Provider[]; reply: string; actions: Action[]; safety: { emergency: boolean; reason: string | null }; contact_required?: boolean };

const DEFAULT_ACTIONS: Action[] = [
  { label: 'Zoek een bedrijf', value: 'Zoek een bedrijf', kind: 'quick_reply' },
  { label: 'Eten & catering', value: 'Eten & catering', kind: 'quick_reply' },
  { label: 'Dienst nodig', value: 'Dienst nodig', kind: 'quick_reply' },
  { label: 'Wat is er te doen?', value: 'Wat is er te doen?', kind: 'quick_reply' },
];

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function formatInline(text: string, providerNames: string[] = []): ReactNode[] {
  const providerPattern = providerNames.filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRegex).join('|');
  const tokenPattern = providerPattern ? `(\\*\\*[^*]+\\*\\*|\`[^\`]+\`|[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|${providerPattern})` : `(\\*\\*[^*]+\\*\\*|\`[^\`]+\`|[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,})`;
  return text.split(new RegExp(tokenPattern, 'gi')).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) return <a key={i} className="chat-email" href={`mailto:${part}`}>{part}</a>;
    if (providerNames.some((name) => name.toLowerCase() === part.toLowerCase())) return <span key={i} className="chat-business-name">{part}</span>;
    return <span key={i}>{part}</span>;
  }).filter(Boolean) as ReactNode[];
}
function renderRichText(text: string, providerNames: string[] = []) {
  const lines = text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const nodes: ReactNode[] = []; let list: string[] = [];
  const flushList = () => { if (!list.length) return; const items = list; list = []; nodes.push(<ul key={`list-${nodes.length}`}>{items.map((item, i) => <li key={i}>{formatInline(item, providerNames)}</li>)}</ul>); };
  lines.forEach((line, index) => {
    if (/^#{1,3}\s/.test(line)) { flushList(); nodes.push(<p className="chat-heading" key={`h-${index}`}>{formatInline(line.replace(/^#{1,3}\s+/, ''), providerNames)}</p>); return; }
    if (/^\d+[.)]\s+/.test(line)) { list.push(line.replace(/^\d+[.)]\s+/, '')); return; }
    if (/^[-*•]\s+/.test(line)) { list.push(line.replace(/^[-*•]\s+/, '')); return; }
    flushList(); nodes.push(<p key={`p-${index}`}>{formatInline(line, providerNames)}</p>);
  }); flushList(); return nodes;
}

function ProviderCards({ providers }: { providers: Provider[] }) {
  if (!providers.length) return null;
  return <div className="chat-provider-results" aria-label="Lokale bedrijven">
    {providers.map((provider) => <article className="chat-provider-card" key={provider.id}>
      <div className="chat-provider-card-top"><div><strong className="chat-provider-name">{provider.name}</strong><span className="chat-provider-category">{provider.category}</span></div>{provider.verified && <span className="chat-provider-verified">Verified</span>}</div>
      {provider.external_source && <div className="chat-provider-category">Live gevonden via {provider.external_source}</div>}
      {provider.rating_score != null && <div className="chat-provider-rating"><Star size={13} fill="currentColor" /><strong>{provider.rating_score.toFixed(1)}/{(provider.rating_max ?? 5).toFixed(0)}</strong><span>· {provider.rating_review_count ?? 0} reviews</span><em>({provider.rating_source ?? 'source'})</em></div>}
      {provider.description && <p>{provider.description}</p>}
      <div className="chat-provider-actions">{provider.phone && <a href={`tel:${provider.phone.replace(/[^+\d]/g, '')}`}><Phone size={13} />Bel</a>}{provider.website && <a href={provider.website} target="_blank" rel="noreferrer">Website</a>}{provider.external_source && provider.source_url && <a href={provider.source_url} target="_blank" rel="noreferrer">Google Maps</a>}</div>
    </article>)}
    {providers.some((provider) => provider.external_source === 'Google Places') && <small className="chat-provider-category">Google Maps/Places attribution: live discovery source.</small>}
  </div>;
}

function ContactGate({ contact, setContact, error, onSubmit }: { contact: Contact; setContact: (value: Contact) => void; error: string; onSubmit: (event: FormEvent) => void }) {
  return <div className="agent-contact-gate"><div className="agent-contact-icon"><img src="/icon.svg" alt="" /></div><h2>Vertel eerst wie je bent</h2><p>Voordat ik je aanvraag verwerk, heb ik je naam, contactgegevens en adres nodig. Zo kunnen we je aanvraag aan de juiste lokale hulp koppelen.</p><form className="agent-contact-form" onSubmit={onSubmit}>
    <label>Naam<input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" placeholder="Voor- en achternaam" required /></label>
    <label>E-mail<input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" placeholder="naam@voorbeeld.nl" required /></label>
    <label>Telefoonnummer<input type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" placeholder="06 12345678" required /></label>
    <label>Adres + huisnummer<input value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} autoComplete="street-address" placeholder="Straatnaam 12" required /></label>
    {error && <div className="agent-contact-error" role="alert">{error}</div>}<button className="agent-contact-submit" type="submit">Verder naar de chat <ArrowRight size={16} /></button>
  </form><small className="agent-contact-note">Deze gegevens zijn nodig om je aanvraag aan jou te koppelen en lokale uitvoering mogelijk te maken.</small></div>;
}

export default function AgentChat({ onClose }: { onClose: () => void }) {
  const [contact, setContact] = useState<Contact>({ name: '', email: '', phone: '', address: '' });
  const [contactCollected, setContactCollected] = useState(false); const [contactError, setContactError] = useState(''); const [messages, setMessages] = useState<Message[]>([]); const [input, setInput] = useState(''); const [typing, setTyping] = useState(false); const [providerNames, setProviderNames] = useState<string[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null); const lastAssistantMessageId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;
  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, typing]);

  function collectContact(e: FormEvent) {
    e.preventDefault(); const phoneDigits = contact.phone.replace(/\D/g, '');
    if (contact.name.trim().length < 2) return setContactError('Vul je naam in.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) return setContactError('Vul een geldig e-mailadres in.');
    if (phoneDigits.length < 8) return setContactError('Vul een geldig telefoonnummer in.');
    if (!/\d/.test(contact.address) || contact.address.trim().length < 5) return setContactError('Vul je adres inclusief huisnummer in.');
    setContactError(''); setContact({ ...contact, name: contact.name.trim(), email: contact.email.trim().toLowerCase(), phone: contact.phone.trim(), address: contact.address.trim() }); setContactCollected(true);
    setMessages([{ id: Date.now(), role: 'assistant', text: 'Goedendag!\n\nWat wil je lokaal regelen? Je kunt het gewoon in je eigen woorden vertellen.', actions: DEFAULT_ACTIONS }]);
  }
  async function sendText(text: string) {
    const value = text.trim(); if (!value || typing || !contactCollected) return;
    setMessages([...messages, { id: Date.now(), role: 'user', text: value }]); setInput(''); setTyping(true);
    try {
      const response = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: value, contact, messages: messages.map((item) => ({ role: item.role, content: item.text })) }) });
      const data: AgentResponse = await response.json();
      if (!response.ok) { if (data.contact_required) { setContactCollected(false); setContactError('Vul je contactgegevens eerst opnieuw in.'); } throw new Error('agent_request_failed'); }
      setProviderNames((current) => Array.from(new Set([...current, ...data.providers.map((provider) => provider.name)])));
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: data.reply, actions: data.actions, providers: data.providers }]);
    } catch { setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: 'Ik kan je vraag op dit moment niet verwerken. Probeer het nog eens.', actions: DEFAULT_ACTIONS }]); }
    finally { setTyping(false); }
  }
  function send(e: FormEvent) { e.preventDefault(); void sendText(input); }

  return <div className="agent-chat-overlay" role="dialog" aria-modal="true" aria-label="Uithoorn AI"><section className="agent-chat-window">
    <header className="agent-chat-header"><div className="agent-chat-title"><div className="agent-avatar"><img src="/icon.svg" alt="" /></div><div><strong>Uithoorn AI</strong><span>Online</span></div></div><div className="agent-chat-actions"><button aria-label="Minimaliseren" title="Minimaliseren"><Minus /></button><button aria-label="Sluiten" title="Sluiten" onClick={onClose}><X /></button></div></header>
    {!contactCollected ? <div className="agent-contact-scroll"><ContactGate contact={contact} setContact={setContact} error={contactError} onSubmit={collectContact} /></div> : <>
      <div className="agent-chat-intro">Lokale hulp, informatie en diensten — vanuit één gesprek.</div>
      <div className="agent-chat-messages" ref={messagesRef} aria-live="polite">{messages.map((message) => {
        const hasProviderResults = message.role === 'assistant' && Boolean(message.providers?.length);
        if (hasProviderResults) return <ProviderCards key={message.id} providers={message.providers!} />;
        return <div className={`agent-message-row ${message.role === 'user' ? 'is-user' : ''}`} data-no-translate="true" key={message.id}>
          <div className={`agent-message-avatar ${message.role === 'user' ? 'user-avatar' : ''}`}>{message.role === 'user' ? 'Jij' : <img src="/icon.svg" alt="" />}</div>
          <div className="agent-message"><span>{message.role === 'user' ? 'Jij' : 'Uithoorn AI'}</span><div className="agent-message-bubble">{renderRichText(message.text, providerNames)}</div>{message.role === 'assistant' && message.actions && message.id === lastAssistantMessageId && <div className="agent-quick-replies" aria-label="Snelle keuzes">{message.actions.map((action) => action.kind === 'emergency' ? <a className="agent-quick-reply" key={`${action.kind}-${action.value}`} href="tel:112">{action.label}</a> : <button className="agent-quick-reply" key={`${action.kind}-${action.value}`} type="button" onClick={() => void sendText(action.value)} disabled={typing}>{action.label}</button>)}</div>}</div>
        </div>;
      })}{typing && <div className="agent-typing" data-no-translate="true"><Loader2 /> Even kijken…</div>}</div>
      <div className="agent-composer-wrap"><form className="agent-chat-composer" onSubmit={send}><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Typ je bericht…" aria-label="Bericht" rows={1} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} /><button type="submit" disabled={!input.trim() || typing} aria-label="Verstuur"><Send /></button></form><div style={{ fontSize: 8, color: '#9a9d98', textAlign: 'center', marginTop: 7 }}>Enter om te versturen · Shift + Enter voor een nieuwe regel</div></div>
    </>}
  </section></div>;
}
