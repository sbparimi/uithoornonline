'use client';

import { useState } from 'react';
import { CalendarDays, ChevronRight, Menu, MessageCircle, Search, Scissors, Sparkles, Store, Tag, Truck, UtensilsCrossed, Wrench, Hammer, Flower2, CarFront, X } from 'lucide-react';
import AgentChat from './agent-chat';

const services = [
  { title: 'Tuin & groen', text: 'Hovenier, tuinonderhoud, snoeien, bestrating en schuttingen.', href: '/businesses?search=garden', icon: Flower2, tone: 'green' },
  { title: 'Schoonmaak', text: 'Schoonmakers voor huis, kantoor, ramen en eenmalige klussen.', href: '/businesses?search=cleaner', icon: Sparkles, tone: 'blue' },
  { title: 'Transport & verhuizen', text: 'Verhuizers, transport, koeriers en hulp bij ophalen of bezorgen.', href: '/businesses?search=transport', icon: Truck, tone: 'purple' },
  { title: 'Kapper & beauty', text: 'Kappers, barbers, beauty en persoonlijke verzorging in de buurt.', href: '/businesses?search=barber', icon: Scissors, tone: 'pink' },
  { title: 'Huis & renovatie', text: 'Renovatie, schilderwerk, vloeren, timmerwerk en verbouwing.', href: '/businesses?search=home%20improvement', icon: Hammer, tone: 'orange' },
  { title: 'Loodgieter & elektra', text: 'Loodgieters, elektriciens, cv, lekkages en installatiewerk.', href: '/businesses?search=plumber', icon: Wrench, tone: 'red' },
  { title: 'Eten & catering', text: 'Restaurants, thuiskeukens, catering, taarten en eten voor elke gelegenheid.', href: '/businesses?search=food%20catering', icon: UtensilsCrossed, tone: 'yellow' },
  { title: 'Auto & vervoer', text: 'Garages, autobedrijven, fietsservice, detailing en mobiliteit.', href: '/businesses?search=auto', icon: CarFront, tone: 'teal' },
];

const explore = [
  { title: 'Bedrijven & diensten', text: 'Ontdek lokale aanbieders en vind direct wat je nodig hebt.', href: '/businesses', icon: Store, tone: 'blue' },
  { title: 'Evenementen & activiteiten', text: 'Zie wat er vandaag en binnenkort in Uithoorn gebeurt.', href: '/events', icon: CalendarDays, tone: 'purple' },
  { title: 'Aanbiedingen', text: 'Bekijk lokale deals, acties en seizoensaanbiedingen.', href: '/deals', icon: Tag, tone: 'orange' },
];

const popularSearches = [
  { label: 'SpiceIndia', href: '/businesses?search=SpiceIndia' },
  { label: 'Tuin & buiten', href: '/businesses?search=garden' },
  { label: 'Huis & klus', href: '/businesses?search=home%20improvement' },
  { label: 'Loodgieter', href: '/businesses?search=plumber' },
  { label: 'Handyman', href: '/businesses?search=handyman' },
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
      <a href="#top" className="uo-home-brand" aria-label="UithoornOnline home"><span className="uo-home-brand-mark"><img src="/icon.svg" alt="" /></span><span>Uithoorn<span>Online</span></span></a>
      <nav className="uo-home-nav" aria-label="Hoofdnavigatie"><a className="active" href="#top">Home</a><a href="/businesses">Bedrijven</a><a href="/events">Evenementen</a><a href="/deals">Aanbiedingen</a><a href="#services">Diensten</a><a href="#about">Over ons</a></nav>
      <div className="uo-home-actions"><a className="uo-home-provider" href="/signup"><span>+</span> Bedrijf toevoegen</a><button className="uo-home-search-button" onClick={() => setChatOpen(true)} aria-label="Zoeken"><Search /></button><button className="uo-home-menu" onClick={() => setMobileOpen((open) => !open)} aria-label="Menu">{mobileOpen ? <X /> : <Menu />}</button></div>
      {mobileOpen && <nav className="uo-home-mobile-nav" aria-label="Mobiele navigatie"><a href="/businesses">Bedrijven</a><a href="/events">Evenementen</a><a href="/deals">Aanbiedingen</a><a href="#services">Diensten</a><a href="/signup">Bedrijf toevoegen</a></nav>}
    </header>

    <section className="uo-home-hero">
      <div className="uo-home-landscape" aria-hidden="true"><div className="uo-home-cloud cloud-a" /><div className="uo-home-cloud cloud-b" /><div className="uo-home-tree tree-a" /><div className="uo-home-tree tree-b" /><div className="uo-home-tree tree-c" /><div className="uo-home-windmill"><span /><i /><b /></div><div className="uo-home-bridge"><span /><i /><b /></div><div className="uo-home-water" /></div>
      <div className="uo-home-hero-inner">
        <div className="uo-home-kicker">ONTDEK · VIND · REGEL LOKAAL</div><h1>Hulp nodig in Uithoorn?<br /><em>Vind iemand lokaal.</em></h1><p>Van hovenier en schoonmaker tot loodgieter, kapper, transport of catering.<br />Vind lokale bedrijven die je vandaag kunnen helpen.</p>
        <form className="uo-home-search" onSubmit={submitSearch} role="search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wat heb je nodig? Bijvoorbeeld: hovenier, schilder, kapper..." aria-label="Zoek een dienst in Uithoorn" /><button type="submit">Zoeken</button></form>
        <div className="uo-home-popular"><span>Populair:</span>{popularSearches.map((item) => <a key={item.label} href={item.href}>{item.label}</a>)}</div>
      </div><div className="uo-home-handwriting">Lokaal<br />Verbindt<br />Uithoorn <span>♡</span></div>
    </section>

    <section className="uo-home-services" id="services" aria-labelledby="services-title">
      <div className="uo-home-section-heading"><div><span className="uo-home-section-kicker">LOKALE DIENSTEN</span><h2 id="services-title">Waar heb je hulp bij nodig?</h2></div><p>Zoek direct naar een lokale specialist, dienst of bedrijf.</p></div>
      <div className="uo-home-service-grid">{services.map(({ title, text, href, icon: Icon, tone }) => <a key={title} href={href} className={`uo-home-service-card tone-${tone}`}><span className="uo-home-service-icon"><Icon /></span><span className="uo-home-service-copy"><strong>{title}</strong><span>{text}</span><small>Bekijk lokale aanbieders <ChevronRight /></small></span></a>)}</div>
      <a className="uo-home-service-request" href="/businesses"><span><strong>Niet zeker welke dienst je nodig hebt?</strong><small>Vertel ons wat je wilt regelen. We helpen je de juiste lokale categorie te vinden.</small></span><span>Ik zoek hulp <ChevronRight /></span></a>
    </section>

    <section className="uo-home-explore" aria-label="Meer ontdekken"><div className="uo-home-explore-grid">{explore.map(({ title, text, href, icon: Icon, tone }) => <a key={title} href={href} className={`uo-home-explore-card tone-${tone}`}><span className="uo-home-card-icon"><Icon /></span><span className="uo-home-card-copy"><strong>{title}</strong><span>{text}</span></span><span className="uo-home-card-arrow"><ChevronRight /></span></a>)}</div></section>
    <section className="uo-home-bottom" id="about"><span>Samen maken we Uithoorn sterker</span><span className="uo-home-heart">♥</span></section>
    {!chatOpen && <button className="uo-home-chat-launch" onClick={() => setChatOpen(true)} aria-label="Chat met ons"><span>Chat met ons</span><MessageCircle /></button>}
    {chatOpen && <AgentChat onClose={() => setChatOpen(false)} />}
  </main>;
}
