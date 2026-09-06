'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, Loader2, Minus, Send, Sparkles, X } from 'lucide-react';

type Message = { id: number; role: 'agent' | 'user' | 'system'; text: string; agent?: string };

const specialistMap: Record<string, { name: string; label: string; prompt: string }> = {
  cleaning: { name: 'Cleaner Agent', label: 'Schoonmaak specialist', prompt: 'Ik heb je schoonmaakvraag begrepen. Ik verzamel nu de details die nodig zijn om een passende lokale schoonmaker te vinden.' },
  garden: { name: 'Garden Agent', label: 'Tuin specialist', prompt: 'Ik herken een tuintaak. Ik kijk naar het type werk, locatie, timing en budget zodat de juiste lokale specialist kan worden geselecteerd.' },
  transport: { name: 'Transport Agent', label: 'Transport specialist', prompt: 'Ik heb je transportvraag herkend. Ik verzamel de praktische details en werk toe naar een passende lokale uitvoerder.' },
  home: { name: 'Home Agent', label: 'Wonen & klus specialist', prompt: 'Ik heb je klusvraag herkend. Ik bepaal welke vakbekwaamheid en planning nodig zijn voor deze taak.' },
  food: { name: 'Food Agent', label: 'Food specialist', prompt: 'Ik herken een food-vraag. Ik help je rechtstreeks naar een passende lokale food-aanbieder of bestelling.' },
};

function detectSpecialist(text: string) {
  const value = text.toLowerCase();
  if (/schoon|poets|clean|huishoud/.test(value)) return specialistMap.cleaning;
  if (/tuin|gras|heg|bestrating|plant/.test(value)) return specialistMap.garden;
  if (/verhuis|transport|bank|meubel|bezorg|vervoer/.test(value)) return specialistMap.transport;
  if (/loodgieter|elektr|schilder|klus|repar|renovat|dak|install/.test(value)) return specialistMap.home;
  if (/eten|food|catering|biryani|dosa|restaurant|maaltijd/.test(value)) return specialistMap.food;
  return null;
}

export default function AgentChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'agent', agent: 'Uithoorn Agent', text: 'Goedendag. Ik ben je lokale AI-agent.' },
    { id: 2, role: 'agent', agent: 'Uithoorn Agent', text: 'Vertel wat je geregeld wilt hebben. Ik begrijp je vraag, schakel de juiste specialist in en begeleid de taak verder.' },
  ]);
  const [input, setInput] = useState('');
  const [activeAgent, setActiveAgent] = useState('Uithoorn Agent');
  const [typing, setTyping] = useState(false);

  const statusText = useMemo(() => activeAgent === 'Uithoorn Agent' ? 'Orchestrator actief' : `${activeAgent} actief`, [activeAgent]);

  function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || typing) return;
    const specialist = detectSpecialist(text);
    const userMessage: Message = { id: Date.now(), role: 'user', text };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setTyping(true);

    window.setTimeout(() => {
      if (specialist) {
        setActiveAgent(specialist.name);
        setMessages((current) => [...current,
          { id: Date.now() + 1, role: 'system', text: `Intent herkend → ${specialist.label}` },
          { id: Date.now() + 2, role: 'agent', agent: specialist.name, text: specialist.prompt },
          { id: Date.now() + 3, role: 'agent', agent: specialist.name, text: 'Ik heb bijvoorbeeld je postcode en gewenste moment nodig. Wat is de postcode en wanneer wil je dat dit gebeurt?' },
        ]);
      } else {
        setMessages((current) => [...current, { id: Date.now() + 1, role: 'agent', agent: 'Uithoorn Agent', text: 'Ik begrijp je vraag. Kun je kort vertellen wat er precies moet gebeuren en in welke plaats of postcode?' }]);
      }
      setTyping(false);
    }, 550);
  }

  return <div className="agent-chat-overlay" role="dialog" aria-modal="true" aria-label="Uithoorn Agent chat">
    <section className="agent-chat-window">
      <header className="agent-chat-header">
        <div className="agent-chat-title"><div className="agent-avatar"><Bot /></div><div><strong>Uithoorn Agent</strong><span>{statusText}</span></div></div>
        <div className="agent-chat-actions"><button aria-label="Minimaliseren" title="Minimaliseren"><Minus /></button><button aria-label="Sluiten" title="Sluiten" onClick={onClose}><X /></button></div>
      </header>
      <div className="agent-chat-intro"><Sparkles /><span>Je chat met een lokale AI-agent die je vraag coördineert.</span></div>
      <div className="agent-chat-messages" aria-live="polite">
        {messages.map((message) => message.role === 'system' ? <div className="agent-routing" key={message.id}><CheckCircle2 />{message.text}</div> : <div className={`agent-message-row ${message.role === 'user' ? 'is-user' : ''}`} key={message.id}><div className={`agent-message-avatar ${message.role === 'user' ? 'user-avatar' : ''}`}>{message.role === 'user' ? 'Jij' : <Bot />}</div><div className="agent-message"><span>{message.agent || 'Jij'}</span><p>{message.text}</p></div></div>)}
        {typing && <div className="agent-typing"><Loader2 /> specialist agent denkt na…</div>}
      </div>
      <form className="agent-chat-composer" onSubmit={send}><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Typ je bericht…" aria-label="Bericht" rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} /><button type="submit" disabled={!input.trim() || typing} aria-label="Verstuur"><Send /></button></form>
      <footer className="agent-chat-footer">De Orchestrator bepaalt welke specialist je aanvraag uitvoert. Jij blijft in één gesprek.</footer>
    </section>
  </div>;
}
