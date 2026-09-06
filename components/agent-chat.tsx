'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Minus, Send, Sparkles, X } from 'lucide-react';

type Message = { id: number; role: 'agent' | 'user' | 'system'; text: string; agent?: string };
type Provider = { id: string; name: string; category: string; description: string; postcode: string | null; phone: string | null; website: string | null; verified: boolean };
type AgentResponse = { intent: string | null; specialist: { name: string; label: string } | null; providers: Provider[]; reply: string };

export default function AgentChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'agent', agent: 'Uithoorn Agent', text: 'Goedendag. Ik ben je lokale AI-agent.' },
    { id: 2, role: 'agent', agent: 'Uithoorn Agent', text: 'Vertel wat je geregeld wilt hebben. Ik begrijp je vraag, schakel de juiste specialist in en zoek alleen in geverifieerde lokale bedrijfsinformatie.' },
  ]);
  const [input, setInput] = useState('');
  const [activeAgent, setActiveAgent] = useState('Uithoorn Agent');
  const [typing, setTyping] = useState(false);

  const statusText = useMemo(() => activeAgent === 'Uithoorn Agent' ? 'Orchestrator actief' : `${activeAgent} actief`, [activeAgent]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || typing) return;
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text }]);
    setInput('');
    setTyping(true);

    try {
      const response = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: text }) });
      const data: AgentResponse = await response.json();
      if (!response.ok) throw new Error('agent_request_failed');

      setActiveAgent(data.specialist?.name || 'Uithoorn Agent');
      const next: Message[] = [];
      if (data.specialist) next.push({ id: Date.now() + 1, role: 'system', text: `Intent herkend → ${data.specialist.label}` });
      if (data.specialist) next.push({ id: Date.now() + 2, role: 'agent', agent: data.specialist.name, text: data.reply });
      else next.push({ id: Date.now() + 2, role: 'agent', agent: 'Uithoorn Agent', text: data.reply });
      if (data.providers?.length) next.push({ id: Date.now() + 3, role: 'agent', agent: data.specialist?.name || 'Uithoorn Agent', text: data.providers.map((provider) => `• ${provider.name}${provider.postcode ? ` — ${provider.postcode}` : ''}`).join('\n') });
      setMessages((current) => [...current, ...next]);
    } catch {
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'agent', agent: 'Uithoorn Agent', text: 'Ik kan de lokale bedrijfsinformatie nu niet ophalen. Probeer je vraag opnieuw.' }]);
    } finally {
      setTyping(false);
    }
  }

  return <div className="agent-chat-overlay" role="dialog" aria-modal="true" aria-label="Uithoorn Agent chat">
    <section className="agent-chat-window">
      <header className="agent-chat-header">
        <div className="agent-chat-title"><div className="agent-avatar"><Bot /></div><div><strong>Uithoorn Agent</strong><span>{statusText}</span></div></div>
        <div className="agent-chat-actions"><button aria-label="Minimaliseren" title="Minimaliseren"><Minus /></button><button aria-label="Sluiten" title="Sluiten" onClick={onClose}><X /></button></div>
      </header>
      <div className="agent-chat-intro"><Sparkles /><span>De Orchestrator begrijpt je intentie en schakelt de juiste lokale specialist in.</span></div>
      <div className="agent-chat-messages" aria-live="polite">
        {messages.map((message) => message.role === 'system' ? <div className="agent-routing" key={message.id}><CheckCircle2 />{message.text}</div> : <div className={`agent-message-row ${message.role === 'user' ? 'is-user' : ''}`} key={message.id}><div className={`agent-message-avatar ${message.role === 'user' ? 'user-avatar' : ''}`}>{message.role === 'user' ? 'Jij' : <Bot />}</div><div className="agent-message"><span>{message.agent || 'Jij'}</span><p>{message.text}</p></div></div>)}
        {typing && <div className="agent-typing"><Loader2 /> specialist agent raadpleegt lokale bedrijfsinformatie…</div>}
      </div>
      <form className="agent-chat-composer" onSubmit={send}><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Typ je bericht…" aria-label="Bericht" rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} /><button type="submit" disabled={!input.trim() || typing} aria-label="Verstuur"><Send /></button></form>
      <footer className="agent-chat-footer">Je blijft in één gesprek. De Orchestrator coördineert specialist, bedrijfsinformatie en de volgende actie.</footer>
    </section>
  </div>;
}
