'use client';

import { FormEvent, useState } from 'react';
import { Bot, Loader2, Minus, Send, X } from 'lucide-react';

type Message = { id: number; role: 'assistant' | 'user'; text: string };
type Provider = { id: string; name: string; category: string; description: string; postcode: string | null; phone: string | null; website: string | null };
type AgentResponse = { providers: Provider[]; reply: string };

export default function AgentChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: 'Goedendag!' },
    { id: 2, role: 'assistant', text: 'Waar kan ik je mee helpen? Vertel gewoon wat je nodig hebt. Ik help je het lokaal te regelen.' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || typing) return;

    const nextMessages = [...messages, { id: Date.now(), role: 'user' as const, text }];
    setMessages(nextMessages);
    setInput('');
    setTyping(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: text,
          messages: nextMessages.map((item) => ({ role: item.role, content: item.text })),
        }),
      });
      const data: AgentResponse = await response.json();
      if (!response.ok) throw new Error('agent_request_failed');

      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: 'assistant', text: data.reply },
      ]);
    } catch {
      setMessages((current) => [...current, {
        id: Date.now() + 1,
        role: 'assistant',
        text: 'Ik kan je vraag op dit moment niet verwerken. Probeer het nog eens.',
      }]);
    } finally {
      setTyping(false);
    }
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

      <div className="agent-chat-intro"><span>Je chat met een digitale AI-assistent.</span></div>

      <div className="agent-chat-messages" aria-live="polite">
        {messages.map((message) => (
          <div className={`agent-message-row ${message.role === 'user' ? 'is-user' : ''}`} key={message.id}>
            <div className={`agent-message-avatar ${message.role === 'user' ? 'user-avatar' : ''}`}>
              {message.role === 'user' ? 'Jij' : <Bot />}
            </div>
            <div className="agent-message">
              <span>{message.role === 'user' ? 'Jij' : 'Uithoorn AI'}</span>
              <p>{message.text}</p>
            </div>
          </div>
        ))}
        {typing && <div className="agent-typing"><Loader2 /> Even kijken…</div>}
      </div>

      <form className="agent-chat-composer" onSubmit={send}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Typ je bericht…"
          aria-label="Bericht"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
        />
        <button type="submit" disabled={!input.trim() || typing} aria-label="Verstuur"><Send /></button>
      </form>
    </section>
  </div>;
}
