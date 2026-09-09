'use client';

import { useState } from 'react';
import { CalendarDays, ChevronRight, Menu, PencilLine, Search, Store, Tag, X, MessageCircle } from 'lucide-react';
import AgentChat from './agent-chat';

const cards = [
  { title: 'Een plek in Uithoorn', text: 'Vind een restaurant, winkel, school, kliniek, sportclub of andere plek met adres en openingstijden.', href: '/businesses', icon: Store, tone: 'blue' },
  { title: 'Wat gebeurt er?', text: 'Ontdek lokale evenementen, activiteiten, lessen en initiatieven. Mis niets van wat er in Uithoorn gebeurt.', href: '/events', icon: CalendarDays, tone: 'purple' },
  { title: 'Aanbiedingen van lokale bedrijven', text: 'Bekijk kortingen, speciale aanbiedingen, nieuwe producten en seizoensdeals van lokale bedrijven.', href: '/deals', icon: Tag, tone: 'orange' },
  { title: 'Deel wat je weet', text: 'Voeg een bedrijf, evenement of handige tip toe en help anderen het beste van Uithoorn te ontdekken.', href: '/signup', icon: PencilLine, tone: 'green' },
];

export function HomePage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    window.location.href = value ? `/businesses?search=${encodeURIComponent(value)}` : '/businesses';
  }

  return <main className={`uo-home ${chatOpen ? 'uo-home-chat-open' : ''}`} id="top">
    <header className="uo-home-header">
      <a href="#top" className="uo-home-brand" aria-label="UithoornOnline home">
        <span className="uo-home-brand-mark"><img src="/icon.svg" alt="" /></span>
        <span>Uithoorn<span>Online</span></span>
      </a>
      <nav className="uo-home-nav" aria-label="Hoofdnavigatie">
        <a className="active" href="#top">Home</a>
        <a href="/businesses">Bedrijven</a>
        <a href="/events">Evenementen</a>
        <a href="/deals">Aanbiedingen</a>
        <a href="#about">Informatie</a>
        <a href="#about">Over ons</a>
      </nav>
      <div className="uo-home-actions">
        <a className="uo-home-provider" href="/signup"><span>+</span> Bedrijf toevoegen</a>
        <button className="uo-home-search-button" onClick={() => setChatOpen(true)} aria-label="Zoeken"><Search /></button>
        <button className="uo-home-menu" onClick={() => setMobileOpen((open) => !open)} aria-label="Menu">{mobileOpen ? <X /> : <Menu />}</button>
      </div>
      {mobileOpen && <nav className="uo-home-mobile-nav" aria-label="Mobiele navigatie"><a href="/businesses">Bedrijven</a><a href="/events">Evenementen</a><a href="/deals">Aanbiedingen</a><a href="#about">Informatie</a><a href="/signup">Bedrijf toevoegen</a></nav>}
    </header>

    <section className="uo-home-hero">
      <div className="uo-home-landscape" aria-hidden="true">
        <div className="uo-home-cloud cloud-a" /><div className="uo-home-cloud cloud-b" />
        <div className="uo-home-tree tree-a" /><div className="uo-home-tree tree-b" /><div className="uo-home-tree tree-c" />
        <div className="uo-home-windmill"><span /><i /><b /></div>
        <div className="uo-home-bridge"><span /><i /><b /></div>
        <div className="uo-home-water" />
      </div>
      <div className="uo-home-hero-inner">
        <div className="uo-home-kicker">ONTDEK · VERKEN · STEUN LOKAAL</div>
        <h1>Alles in Uithoorn,<br /><em>op één plek</em></h1>
        <p>Vind lokale bedrijven, evenementen, aanbiedingen en handige informatie.<br />Ontdek wat er gebeurt in Uithoorn en steun je lokale gemeenschap.</p>
        <form className="uo-home-search" onSubmit={submitSearch} role="search">
          <Search aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek een restaurant, winkel, evenement, dienst..." aria-label="Zoek in Uithoorn" />
          <button type="submit">Zoeken</button>
        </form>
        <div className="uo-home-popular"><span>Populaire zoekopdrachten:</span><a href="/businesses?category=restaurant">Restaurants</a><a href="/businesses?category=cafe">Cafés</a><a href="/events">Evenementen</a><a href="/businesses?category=shop">Winkels</a><a href="/businesses?category=service">Diensten</a></div>
      </div>
      <div className="uo-home-handwriting">Lokaal<br />Verbindt<br />Uithoorn <span>♡</span></div>
    </section>

    <section className="uo-home-cards" aria-label="Ontdek Uithoorn">
      {cards.map(({ title, text, href, icon: Icon, tone }) => <a key={title} href={href} className={`uo-home-card tone-${tone}`}>
        <span className="uo-home-card-icon"><Icon /></span>
        <span className="uo-home-card-copy"><strong>{title}</strong><span>{text}</span></span>
        <span className="uo-home-card-arrow"><ChevronRight /></span>
      </a>)}
    </section>

    <section className="uo-home-bottom" id="about"><span>Samen maken we Uithoorn sterker</span><span className="uo-home-heart">♥</span></section>

    {!chatOpen && <button className="uo-home-chat-launch" onClick={() => setChatOpen(true)} aria-label="Chat met ons"><span>Chat met ons</span><MessageCircle /></button>}
    {chatOpen && <AgentChat onClose={() => setChatOpen(false)} />}
  </main>;
}
