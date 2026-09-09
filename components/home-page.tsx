'use client';

import { useState } from 'react';
import { ArrowRight, CalendarDays, ChevronRight, Menu, PencilLine, Search, Store, Tag, X, MessageCircle } from 'lucide-react';
import AgentChat from './agent-chat';

const cards = [
  { title: 'A place in Uithoorn', text: 'Find a restaurant, shop, school, clinic, sports club or any other place with address and opening hours.', href: '/businesses', icon: Store, tone: 'blue' },
  { title: "What's happening", text: "Discover local events, activities, classes and initiatives. Never miss what's happening in Uithoorn.", href: '/events', icon: CalendarDays, tone: 'purple' },
  { title: 'Offers from local businesses', text: 'Check out discounts, special offers, new arrivals and seasonal deals from Uithoorn’s local businesses.', href: '/deals', icon: Tag, tone: 'orange' },
  { title: 'Share what you know', text: 'Add a business, event or helpful tip and help others discover the best of Uithoorn.', href: '/signup', icon: PencilLine, tone: 'green' },
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
        <a href="/info">Informatie</a>
        <a href="#about">Over ons</a>
      </nav>
      <div className="uo-home-actions">
        <a className="uo-home-provider" href="/signup"><span>+</span> Bedrijf toevoegen</a>
        <button className="uo-home-search-button" onClick={() => setChatOpen(true)} aria-label="Zoeken"><Search /></button>
        <button className="uo-home-menu" onClick={() => setMobileOpen((open) => !open)} aria-label="Menu">{mobileOpen ? <X /> : <Menu />}</button>
      </div>
      {mobileOpen && <nav className="uo-home-mobile-nav"><a href="/businesses">Bedrijven</a><a href="/events">Evenementen</a><a href="/deals">Aanbiedingen</a><a href="/info">Informatie</a><a href="/signup">Bedrijf toevoegen</a></nav>}
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
        <div className="uo-home-kicker">DISCOVER · EXPLORE · SUPPORT LOCAL</div>
        <h1>Everything in Uithoorn,<br /><em>in one place</em></h1>
        <p>Find local businesses, events, offers and helpful information.<br />Discover what’s happening in Uithoorn and support your local community.</p>
        <form className="uo-home-search" onSubmit={submitSearch} role="search">
          <Search aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a restaurant, shop, event, service..." aria-label="Search Uithoorn" />
          <button type="submit">Search</button>
        </form>
        <div className="uo-home-popular"><span>Popular searches:</span><a href="/businesses?category=restaurant">Restaurants</a><a href="/businesses?category=cafe">Cafés</a><a href="/events">Events</a><a href="/businesses?category=shop">Shops</a><a href="/businesses?category=service">Services</a></div>
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

    <section className="uo-home-bottom" id="about"><span>Together we make Uithoorn stronger</span><span className="uo-home-heart">♥</span></section>

    {!chatOpen && <button className="uo-home-chat-launch" onClick={() => setChatOpen(true)} aria-label="Chat met ons"><span>Chat met ons</span><MessageCircle /></button>}
    {chatOpen && <AgentChat onClose={() => setChatOpen(false)} />}
  </main>;
}
