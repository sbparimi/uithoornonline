'use client';

import { useState } from 'react';
import { ArrowRight, ChevronRight, Menu, MessageCircle, Search, Sparkles, X } from 'lucide-react';
import AgentChat from './agent-chat';

const services = [
  ['Tuin & groen', 'Hovenier, onderhoud, snoeien', '/businesses?search=garden'],
  ['Schoonmaak', 'Huis, kantoor, ramen', '/businesses?search=cleaner'],
  ['Verhuizen', 'Verhuizer, transport, koerier', '/businesses?search=transport'],
  ['Kapper & beauty', 'Kapper, barber, salon', '/businesses?search=barber'],
  ['Huis & klus', 'Schilder, timmerman, renovatie', '/businesses?search=home%20improvement'],
  ['Loodgieter & elektra', 'Lekkage, cv, elektra', '/businesses?search=plumber'],
  ['Eten & catering', 'Eten, catering, thuiskeuken', '/businesses?search=food%20catering'],
  ['Auto & vervoer', 'Garage, fiets, detailing', '/businesses?search=auto'],
] as const;

const quick = [
  ['Loodgieter', '/businesses?search=plumber'],
  ['Tuinman', '/businesses?search=garden'],
  ['Handyman', '/businesses?search=handyman'],
  ['Catering', '/businesses?search=food%20catering'],
] as const;

export function HomePage() {
  const [query, setQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    window.location.href = q ? `/businesses?search=${encodeURIComponent(q)}` : '/businesses';
  }

  return (
    <main className="uo-easy-home">
      <header className="easy-header">
        <a href="/" className="easy-brand" aria-label="Uithoorn.online home">
          <span className="easy-brand-mark"><img src="/icon.svg" alt="" /></span>
          <span>Uithoorn<span>.online</span></span>
        </a>
        <nav className="easy-nav" aria-label="Hoofdnavigatie">
          <a className="active" href="/businesses">Diensten</a>
          <a href="/request">Hulp aanvragen</a>
        </nav>
        <div className="easy-header-actions">
          <a className="easy-provider-link" href="/voor-bedrijven">Voor bedrijven</a>
          <a className="easy-primary-small" href="/request">Hulp aanvragen</a>
          <button className="easy-menu" onClick={() => setMobileOpen(v => !v)} aria-label="Menu" aria-expanded={mobileOpen}>{mobileOpen ? <X /> : <Menu />}</button>
        </div>
        {mobileOpen && <nav className="easy-mobile-nav" aria-label="Mobiele navigatie"><a href="/businesses">Diensten</a><a href="/request">Hulp aanvragen</a><a href="/voor-bedrijven">Voor bedrijven</a></nav>}
      </header>

      <section className="easy-hero"><div className="easy-hero-inner"><div className="easy-eyebrow"><span />Uithoorn &amp; De Kwakel</div><h1>Wat heb je nodig?</h1><p>Vind snel lokale hulp. Of vertel ons wat je nodig hebt.</p><form className="easy-main-search" onSubmit={submitSearch}><Search aria-hidden="true" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Bijvoorbeeld: lekkage, tuinman, kapper..." aria-label="Zoek een dienst" /><button type="submit">Zoeken</button></form><div className="easy-quick"><span>Populair</span>{quick.map(([label, href]) => <a key={label} href={href}>{label}</a>)}</div></div></section>

      <section className="easy-primary-actions" aria-label="Kies wat je wilt doen"><div className="easy-primary-actions-inner"><a href="/businesses" className="easy-action-card easy-action-services"><div className="easy-action-icon"><Search /></div><div className="easy-action-copy"><span className="easy-label">DIENSTEN</span><h2>Vind een lokaal bedrijf</h2><p>Zoek op dienst, bekijk aanbieders en neem direct contact op.</p></div><ArrowRight className="easy-action-arrow" /></a><a href="/request" className="easy-action-card easy-action-help"><div className="easy-action-icon"><Sparkles /></div><div className="easy-action-copy"><span className="easy-label">HULP NODIG?</span><h2>Vertel wat je nodig hebt</h2><p>Geen idee wie je moet bellen? Beschrijf je vraag. Wij helpen je verder.</p></div><ArrowRight className="easy-action-arrow" /></a></div></section>

      <section className="easy-section easy-services-section" id="diensten"><div className="easy-section-head"><div><span className="easy-label">DIENSTEN IN DE BUURT</span><h2>Kies een dienst</h2></div><a href="/businesses">Alle diensten <ChevronRight /></a></div><div className="easy-service-grid">{services.map(([title, text, href]) => <a key={title} href={href} className="easy-service-card"><span><strong>{title}</strong><small>{text}</small></span><ChevronRight className="easy-chevron" /></a>)}</div></section>

      <section className="easy-how"><div className="easy-how-inner"><div><span className="easy-label">EENVOUDIG</span><h2>Van vraag naar lokale hulp.</h2></div><div className="easy-how-steps"><div><b>01</b><span>Vertel wat je zoekt</span></div><div><b>02</b><span>Vind een passende aanbieder</span></div><div><b>03</b><span>Neem contact op</span></div></div></div></section>

      <section className="easy-provider-banner"><div><span className="easy-label">VOOR BEDRIJVEN</span><h2>Krijg lokale klantaanvragen.</h2><p>Word gevonden door bewoners die nu hulp zoeken. Start gratis en groei met echte leads.</p></div><a href="/voor-bedrijven">Voor bedrijven <ArrowRight /></a></section>

      <footer className="easy-footer"><div className="easy-footer-brand"><span className="easy-brand-mark"><img src="/icon.svg" alt="" /></span><strong>Uithoorn<span>.online</span></strong></div><div className="easy-footer-links"><a href="/businesses">Diensten</a><a href="/request">Hulp aanvragen</a><a href="/voor-bedrijven">Voor bedrijven</a></div><small>Uithoorn &amp; De Kwakel · © 2026</small></footer>
      {!chatOpen && <button className="easy-chat" onClick={() => setChatOpen(true)} aria-label="Open hulp"><MessageCircle /><span>Hulp nodig?</span></button>}
      {chatOpen && <AgentChat onClose={() => setChatOpen(false)} />}
    </main>
  );
}
