'use client';

import { useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, MapPin, Menu, X } from 'lucide-react';
import AgentChat from './agent-chat';

export function HomePage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return <main className="uo-agent-site" id="top">
    <header className="uo-agent-header">
      <a href="#top" className="uo-agent-brand" aria-label="Uithoorn.online home"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>uithoorn<span>.online</span></span></a>
      <nav className="uo-agent-nav" aria-label="Hoofdnavigatie"><a href="#local">Lokaal</a></nav>
      <div className="uo-agent-header-actions"><span><MapPin /> Uithoorn & De Kwakel</span><a href="/signup">Voor ondernemers</a><button className="uo-agent-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">{mobileOpen ? <X /> : <Menu />}</button></div>
      {mobileOpen && <nav className="uo-agent-mobile-nav"><a href="#local" onClick={() => setMobileOpen(false)}>Lokaal</a><a href="/signup">Voor ondernemers</a></nav>}
    </header>

    <section className="uo-agent-hero">
      <div className="uo-agent-hero-copy">
        <div className="uo-agent-eyebrow"><span className="uo-live-dot" /> AI AGENT FOR LOCAL TASKS</div>
        <h1>Vertel wat je nodig hebt.<br /><em>Wij regelen de rest.</em></h1>
        <p>Uithoorn.online is een AI-agent voor lokale taken. Eén gesprek begrijpt je intentie, schakelt de juiste specialist in en brengt je vraag van verzoek naar uitvoering.</p>
        <button className="uo-agent-primary" onClick={() => setChatOpen(true)}>Start de chat <ArrowRight /></button>
        <div className="uo-agent-trust"><CheckCircle2 /> Geen formulieren. Geen zoeken door tientallen aanbieders. Eén gesprek.</div>
      </div>
      <button className="uo-agent-launch-card" onClick={() => setChatOpen(true)} aria-label="Start de Uithoorn Agent chat">
        <div className="uo-agent-launch-top"><div className="uo-agent-large-avatar"><Bot /></div><span>Uithoorn Agent <small>● online</small></span></div>
        <h2>Heb je een lokale taak?</h2>
        <p>Vertel wat er moet gebeuren. De Orchestrator begrijpt je intentie en schakelt automatisch de juiste specialist agent in.</p>
        <span className="uo-agent-launch-button">Start de chat <ArrowRight /></span>
      </button>
    </section>

    <section className="uo-agent-local" id="local"><div className="uo-agent-local-copy"><div className="uo-agent-section-label">BUILT FOR UITHOORN</div><h2>Lokale uitvoering.<br /><em>Niet alleen lokale informatie.</em></h2><p>De waarde van Uithoorn.online zit niet in een lijst met telefoonnummers. De agent helpt een inwoner een concrete taak daadwerkelijk verder te brengen — met lokale aanbieders, relevante informatie en opvolging in hetzelfde gesprek.</p><button className="uo-agent-secondary" onClick={() => setChatOpen(true)}>Probeer een lokale taak <ArrowRight /></button></div><div className="uo-agent-orchestration"><div className="uo-orch-center"><Bot /><span>Orchestrator</span></div><div className="uo-orch-line line-1" /><div className="uo-orch-line line-2" /><div className="uo-orch-line line-3" /><div className="uo-orch-node node-1"><strong>Cleaner</strong><small>Task execution</small></div><div className="uo-orch-node node-2"><strong>Garden</strong><small>Task execution</small></div><div className="uo-orch-node node-3"><strong>Transport</strong><small>Task execution</small></div></div></section>

    <section className="uo-agent-business"><div><div className="uo-agent-section-label">FOR LOCAL PROVIDERS</div><h2>Word de specialist die<br /><em>lokale taken uitvoert.</em></h2><p>Ontvang relevante opdrachten die passen bij jouw diensten, werkgebied en capaciteit.</p></div><a href="/signup">Word lokale provider <ArrowRight /></a></section>
    <footer className="uo-agent-footer"><a href="#top" className="uo-agent-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>uithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer>
    {chatOpen && <AgentChat onClose={() => setChatOpen(false)} />}
  </main>;
}
