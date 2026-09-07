'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Minus, Phone, Send, X } from 'lucide-react';

type Message = { id: number; role: 'assistant' | 'user'; text: string; quickReplies?: string[] };
type Provider = { id: string; name: string; category: string; description: string; postcode: string | null; phone: string | null; website: string | null };
type AgentResponse = { providers: Provider[]; reply: string };

const DEFAULT_QUICK_REPLIES = ['Zoek een bedrijf', 'Eten & catering', 'Dienst nodig', 'Wat is er te doen?'];
const EMERGENCY_QUICK_REPLIES = ['Bel 112', 'Politie (niet-spoed)', 'Ik heb hulp nodig'];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatInline(text: string, providerNames: string[] = []): ReactNode[] {
  const providerPattern = providerNames.filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRegex).join('|');
  const tokenPattern = providerPattern
    ? `(\\*\\*[^*]+\\*\\*|\`[^\`]+\`|[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|${providerPattern})`
    : `(\\*\\*[^*]+\\*\\*|\`[^\`]+\`|[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,})`;
  const parts = text.split(new RegExp(tokenPattern, 'gi'));
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) {
      return <a key={i} className="chat-email" href={`mailto:${part}`}>{part}</a>;
    }
    if (providerNames.some((name) => name.toLowerCase() === part.toLowerCase())) {
      return <span key={i} className="chat-business-name">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  }).filter(Boolean) as ReactNode[];
}

function renderRichText(text: string, providerNames: string[] = []) {
  const lines = text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const nodes: ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    const items = list;
    list = [];
    nodes.push(<ul key={`list-${nodes.length}`}>{items.map((item, i) => <li key={i}>{formatInline(item, providerNames)}</li>)}</ul>);
  };

  lines.forEach((line, index) => {
    const emergency = /\b112\b/.test(line) && /(urgent|nood|emergency|spoed|danger|gevaar|bel|call|only number|immediate)/i.test(line);
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      nodes.push(<p className="chat-heading" key={`h-${index}`}>{formatInline(line.replace(/^#{1,3}\s+/, ''), providerNames)}</p>);
      return;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      list.push(line.replace(/^\d+[.)]\s+/, ''));
      return;
    }
    if (/^[-*•]\s+/.test(line)) {
      list.push(line.replace(/^[-*•]\s+/, ''));
      return;
    }
    flushList();
    if (emergency) {
      nodes.push(
        <div className="chat-emergency" key={`e-${index}`}>
          <strong>Directe hulp nodig?</strong>
          <span>{formatInline(line, providerNames)}</span>
          <a className="chat-emergency-number" href="tel:112"><Phone size={15} />112</a>
        </div>
      );
      return;
    }
    nodes.push(<p key={`p-${index}`}>{formatInline(line, providerNames)}</p>);
  });
  flushList();
  return nodes;
}

function quickRepliesFor(text: string) {
  return /\b112\b|nood|spoed|emergency|urgent|politie/i.test(text) ? EMERGENCY_QUICK_REPLIES : DEFAULT_QUICK_REPLIES;
}

export default function AgentChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: 'Goedendag!', quickReplies: DEFAULT_QUICK_REPLIES },
    { id: 2, role: 'assistant', text: 'Wat wil je lokaal regelen? Je kunt het gewoon in je eigen woorden vertellen.', quickReplies: DEFAULT_QUICK_REPLIES },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [providerNames, setProviderNames] = useState<string[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  async function sendText(text: string) {
    const value = text.trim();
    if (!value || typing) return;
    const nextMessages = [...messages, { id: Date.now(), role: 'user' as const, text: value }];
    setMessages(nextMessages);
    setInput('');
    setTyping(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: value,
          messages: nextMessages.map((item) => ({ role: item.role, content: item.text })),
        }),
      });
      const data: AgentResponse = await response.json();
      if (!response.ok) throw new Error('agent_request_failed');
      setProviderNames((current) => Array.from(new Set([...current, ...data.providers.map((provider) => provider.name)])));
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: data.reply, quickReplies: quickRepliesFor(data.reply) }]);
    } catch {
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: 'Ik kan je vraag op dit moment niet verwerken. Probeer het nog eens.', quickReplies: DEFAULT_QUICK_REPLIES }]);
    } finally {
      setTyping(false);
    }
  }

  function send(e: FormEvent) {
    e.preventDefault();
    void sendText(input);
  }

  return <div className="agent-chat-overlay" role="dialog" aria-modal="true" aria-label="Uithoorn AI">
    <section className="agent-chat-window">
      <header className="agent-chat-header">
        <div className="agent-chat-title">
          <div className="agent-avatar"><Bot /></div>
          <div><strong>Uithoorn AI</strong><span>Online</span></div>
        </div>
        <div className="agent-chat-actions">
          <button aria-label="Minimaliseren" title="Minimaliseren"><Minus /></button>
          <button aria-label="Sluiten" title="Sluiten" onClick={onClose}><X /></button>
        </div>
      </header>
      <div className="agent-chat-intro">Lokale hulp, informatie en diensten — vanuit één gesprek.</div>
      <div className="agent-chat-messages" ref={messagesRef} aria-live="polite">
        {messages.map((message) => (
          <div className={`agent-message-row ${message.role === 'user' ? 'is-user' : ''}`} key={message.id}>
            <div className={`agent-message-avatar ${message.role === 'user' ? 'user-avatar' : ''}`}>{message.role === 'user' ? 'Jij' : <Bot />}</div>
            <div className="agent-message">
              <span>{message.role === 'user' ? 'Jij' : 'Uithoorn AI'}</span>
              <div className="agent-message-bubble">{renderRichText(message.text, providerNames)}</div>
              {message.role === 'assistant' && message.quickReplies && !typing && (
                <div className="agent-quick-replies" aria-label="Snelle keuzes">
                  {message.quickReplies.map((reply) => (
                    <button className="agent-quick-reply" key={reply} type="button" onClick={() => void sendText(reply)} disabled={typing}>{reply}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {typing && <div className="agent-typing"><Loader2 /> Even kijken…</div>}
      </div>
      <div className="agent-composer-wrap">
        <form className="agent-chat-composer" onSubmit={send}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Typ je bericht…" aria-label="Bericht" rows={1} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} />
          <button type="submit" disabled={!input.trim() || typing} aria-label="Verstuur"><Send /></button>
        </form>
        <div style={{ fontSize: 8, color: '#9a9d98', textAlign: 'center', marginTop: 7 }}>Enter om te versturen · Shift + Enter voor een nieuwe regel</div>
      </div>
    </section>
  </div>;
}
