'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, Minus, Phone, Send, Star, X } from 'lucide-react';

type Provider = { id: string; name: string; category: string; description: string; postcode: string | null; phone: string | null; website: string | null; verified: boolean; rating_score: number | null; rating_max: number | null; rating_review_count: number | null; rating_source: string | null; source_url?: string | null; external_source?: string | null };
type Action = { label: string; value: string; kind: 'quick_reply' | 'emergency' | 'contact_yes' | 'contact_no' };
type Message = { id: number; role: 'assistant' | 'user'; text: string; actions?: Action[]; providers?: Provider[] };
type Contact = { name: string; email: string; phone: string; address: string };
type AgentLanguage = 'nl' | 'en';
type AgentResponse = { providers: Provider[]; reply: string; actions: Action[]; safety: { emergency: boolean; reason: string | null }; contact_offer?: boolean; pending_request?: string; state?: { language: AgentLanguage } };

const DEFAULT_ACTIONS: Action[] = [
  { label: 'Zoek een bedrijf', value: 'Zoek een bedrijf', kind: 'quick_reply' },
  { label: 'Eten & catering', value: 'Eten & catering', kind: 'quick_reply' },
  { label: 'Dienst nodig', value: 'Dienst nodig', kind: 'quick_reply' },
  { label: 'Wat is er te doen?', value: 'Wat is er te doen?', kind: 'quick_reply' },
];

const INITIAL_MESSAGE: Message = {
  id: 1,
  role: 'assistant',
  text: 'Goedendag!\n\nWaar kan ik je mee helpen? Vertel gewoon wat je lokaal nodig hebt.',
  actions: DEFAULT_ACTIONS,
};

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

function ProviderCards({ providers, language }: { providers: Provider[]; language: AgentLanguage }) {
  if (!providers.length) return null;
  const en = language === 'en';
  return <div className="chat-provider-results" aria-label={en ? 'Local businesses' : 'Lokale bedrijven'}>
    {providers.map((provider) => <article className="chat-provider-card" key={provider.id}>
      <div className="chat-provider-card-top"><div><strong className="chat-provider-name">{provider.name}</strong><span className="chat-provider-category">{provider.category}</span></div>{provider.verified && <span className="chat-provider-verified">{en ? 'Verified' : 'Geverifieerd'}</span>}</div>
      {provider.external_source && <div className="chat-provider-category">{en ? `Live found via ${provider.external_source}` : `Live gevonden via ${provider.external_source}`}</div>}
      {provider.rating_score != null && <div className="chat-provider-rating"><Star size={13} fill="currentColor" /><strong>{provider.rating_score.toFixed(1)}/{(provider.rating_max ?? 5).toFixed(0)}</strong><span>· {provider.rating_review_count ?? 0} {en ? 'reviews' : 'reviews'}</span><em>({provider.rating_source ?? 'source'})</em></div>}
      {provider.description && <p>{provider.description}</p>}
      <div className="chat-provider-actions">{provider.phone && <a href={`tel:${provider.phone.replace(/[^+\d]/g, '')}`}><Phone size={13} />{en ? 'Call' : 'Bel'}</a>}{provider.website && <a href={provider.website} target="_blank" rel="noreferrer">Website</a>}{provider.external_source && provider.source_url && <a href={provider.source_url} target="_blank" rel="noreferrer">Google Maps</a>}</div>
    </article>)}
    {providers.some((provider) => provider.external_source === 'Google Places') && <small className="chat-provider-category">Google Maps/Places attribution: live discovery source.</small>}
  </div>;
}

function ContactForm({ contact, setContact, error, language, submitting, onSubmit }: { contact: Contact; setContact: (value: Contact) => void; error: string; language: AgentLanguage; submitting: boolean; onSubmit: (event: FormEvent) => void }) {
  const en = language === 'en';
  return <div className="agent-lead-form-card" data-no-translate="true">
    <div className="agent-lead-form-header"><div className="agent-contact-icon"><img src="/icon.svg" alt="" /></div><div><h3>{en ? 'A few details, then I can help faster' : 'Een paar gegevens, dan kan ik sneller helpen'}</h3><p>{en ? 'Share your details and I will continue with your request immediately.' : 'Deel je gegevens en ik ga direct verder met je aanvraag.'}</p></div></div>
    <form className="agent-contact-form" onSubmit={onSubmit}>
      <label>{en ? 'Name' : 'Naam'}<input name="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" placeholder={en ? 'First and last name' : 'Voor- en achternaam'} required /></label>
      <label>{en ? 'Email' : 'E-mail'}<input name="email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" placeholder="name@example.com" required /></label>
      <label>{en ? 'Phone number' : 'Telefoonnummer'}<input name="phone" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" placeholder={en ? '+31 6 12345678' : '06 12345678'} required /></label>
      <label>{en ? 'Address + house number' : 'Adres + huisnummer'}<input name="address" value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} autoComplete="street-address" placeholder={en ? 'Street 12' : 'Straatnaam 12'} required /></label>
      {error && <div className="agent-contact-error" role="alert">{error}</div>}
      <button className="agent-contact-submit" type="submit" disabled={submitting}>{submitting ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}{en ? 'Continue' : 'Verder'}</button>
    </form>
    <small className="agent-contact-note">{en ? 'Used only to make your local request easier to handle and follow up.' : 'Alleen gebruikt om je lokale aanvraag makkelijker te helpen en op te volgen.'}</small>
  </div>;
}

export default function AgentChat({ onClose }: { onClose: () => void }) {
  const [contact, setContact] = useState<Contact>({ name: '', email: '', phone: '', address: '' });
  const [contactFormVisible, setContactFormVisible] = useState(false);
  const [contactLanguage, setContactLanguage] = useState<AgentLanguage>('nl');
  const [pendingRequest, setPendingRequest] = useState('');
  const [contactError, setContactError] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [providerNames, setProviderNames] = useState<string[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;
  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, typing, contactFormVisible]);

  function validateContact() {
    const phoneDigits = contact.phone.replace(/\D/g, '');
    if (contact.name.trim().length < 2) return contactLanguage === 'en' ? 'Please enter your name.' : 'Vul je naam in.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) return contactLanguage === 'en' ? 'Please enter a valid email address.' : 'Vul een geldig e-mailadres in.';
    if (phoneDigits.length < 8) return contactLanguage === 'en' ? 'Please enter a valid phone number.' : 'Vul een geldig telefoonnummer in.';
    if (!/\d/.test(contact.address) || contact.address.trim().length < 5) return contactLanguage === 'en' ? 'Please enter your address including the house number.' : 'Vul je adres inclusief huisnummer in.';
    return '';
  }

  async function requestAgent(message: string, options: { contactDecision?: 'no'; contact?: Contact; addUserMessage?: boolean } = {}) {
    const value = message.trim(); if (!value || typing || contactSubmitting) return;
    if (options.addUserMessage !== false) setMessages((current) => [...current, { id: Date.now(), role: 'user', text: value }]);
    setInput(''); setTyping(true);
    try {
      const response = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: value, contact: options.contact, contact_decision: options.contactDecision, messages: messages.map((item) => ({ role: item.role, content: item.text })) }) });
      const data: AgentResponse = await response.json();
      if (!response.ok) throw new Error(data.error || 'agent_request_failed');
      const language = data.state?.language || contactLanguage;
      setContactLanguage(language);
      setProviderNames((current) => Array.from(new Set([...current, ...data.providers.map((provider) => provider.name)])));
      if (data.contact_offer) {
        setPendingRequest(data.pending_request || value);
        setContactFormVisible(false);
      }
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: data.reply, actions: data.actions, providers: data.providers }]);
    } catch (error) {
      const failed = error instanceof Error && error.message === 'lead_save_failed';
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: failed ? (contactLanguage === 'en' ? 'I could not securely save those details. Please try again.' : 'Ik kon die gegevens niet veilig opslaan. Probeer het nog eens.') : (contactLanguage === 'en' ? 'I could not complete that request right now. Please try again.' : 'Ik kan die aanvraag op dit moment niet afronden. Probeer het nog eens.'), actions: DEFAULT_ACTIONS }]);
    } finally { setTyping(false); }
  }

  async function handleContactAction(action: Action) {
    if (action.kind === 'contact_yes') {
      setMessages((current) => [...current, { id: Date.now(), role: 'user', text: contactLanguage === 'en' ? 'Yes' : 'Ja' }]);
      setContactError(''); setContactFormVisible(true); return;
    }
    if (action.kind === 'contact_no') {
      setMessages((current) => [...current, { id: Date.now(), role: 'user', text: contactLanguage === 'en' ? 'No' : 'Nee' }]);
      await requestAgent(pendingRequest, { contactDecision: 'no', addUserMessage: false });
      return;
    }
    await requestAgent(action.value);
  }

  async function submitContact(event: FormEvent) {
    event.preventDefault();
    const error = validateContact();
    if (error) { setContactError(error); return; }
    if (!pendingRequest) return;
    setContactError(''); setContactFormVisible(false); setContactSubmitting(true);
    try {
      await requestAgent(pendingRequest, { contact: { ...contact, name: contact.name.trim(), email: contact.email.trim().toLowerCase(), phone: contact.phone.trim(), address: contact.address.trim() }, addUserMessage: false });
    } finally { setContactSubmitting(false); }
  }

  function send(e: FormEvent) { e.preventDefault(); void requestAgent(input); }

  return <div className="agent-chat-overlay" role="dialog" aria-modal="true" aria-label="Uithoorn AI"><section className="agent-chat-window">
    <header className="agent-chat-header"><div className="agent-chat-title"><div className="agent-avatar"><img src="/icon.svg" alt="" /></div><div><strong>Uithoorn AI</strong><span>Online</span></div></div><div className="agent-chat-actions"><button aria-label="Minimaliseren" title="Minimaliseren"><Minus /></button><button aria-label="Sluiten" title="Sluiten" onClick={onClose}><X /></button></div></header>
    <div className="agent-chat-intro">Lokale hulp, informatie en diensten — vanuit één gesprek.</div>
    <div className="agent-chat-messages" ref={messagesRef} aria-live="polite">
      {messages.map((message) => {
        const hasProviderResults = message.role === 'assistant' && Boolean(message.providers?.length);
        if (hasProviderResults) return <ProviderCards key={message.id} providers={message.providers!} language={contactLanguage} />;
        return <div className={`agent-message-row ${message.role === 'user' ? 'is-user' : ''}`} data-no-translate="true" key={message.id}>
          <div className={`agent-message-avatar ${message.role === 'user' ? 'user-avatar' : ''}`}>{message.role === 'user' ? 'Jij' : <img src="/icon.svg" alt="" />}</div>
          <div className="agent-message"><span>{message.role === 'user' ? 'Jij' : 'Uithoorn AI'}</span><div className="agent-message-bubble">{renderRichText(message.text, providerNames)}</div>{message.role === 'assistant' && message.actions && message.id === lastAssistantMessageId && <div className="agent-quick-replies" aria-label="Snelle keuzes">{message.actions.map((action) => action.kind === 'emergency' ? <a className="agent-quick-reply" key={`${action.kind}-${action.value}`} href="tel:112">{action.label}</a> : <button className="agent-quick-reply" key={`${action.kind}-${action.value}`} type="button" onClick={() => void handleContactAction(action)} disabled={typing || contactSubmitting}>{action.label}</button>)}</div>}</div>
        </div>;
      })}
      {contactFormVisible && <ContactForm contact={contact} setContact={setContact} error={contactError} language={contactLanguage} submitting={contactSubmitting} onSubmit={submitContact} />}
      {typing && <div className="agent-typing" data-no-translate="true"><Loader2 /> {contactLanguage === 'en' ? 'Checking…' : 'Even kijken…'}</div>}
    </div>
    <div className="agent-composer-wrap"><form className="agent-chat-composer" onSubmit={send}><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={contactLanguage === 'en' ? 'Type your message…' : 'Typ je bericht…'} aria-label="Bericht" rows={1} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} /><button type="submit" disabled={!input.trim() || typing || contactSubmitting} aria-label="Verstuur"><Send /></button></form><div style={{ fontSize: 8, color: '#9a9d98', textAlign: 'center', marginTop: 7 }}>{contactLanguage === 'en' ? 'Enter to send · Shift + Enter for a new line' : 'Enter om te versturen · Shift + Enter voor een nieuwe regel'}</div></div>
  </section></div>;
}
