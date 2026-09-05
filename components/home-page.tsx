'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, CircleUserRound, MapPin, Menu, Search, Store, Tag, Users, Wrench, X } from 'lucide-react';
import { businesses, events } from '../data';

const navCategories = ['Alles', 'Evenementen', 'Bedrijven', 'Te koop', 'Diensten', 'Groepen', 'Sport', 'Kinderen & gezin', 'Eten & drinken', 'Cultuur', 'Duurzaamheid', 'Hulp'];
const visualCards = [
  { className: 'market', title: ['Uithoorn', 'Local Market'], subtitle: 'lokaal eten · handmade · community' },
  { className: 'walk', title: ['Sunset', 'Walk'], subtitle: 'natuur · buren · goede vibes' },
  { className: 'coffee', title: ['Coffee', '& Connect'], subtitle: 'ontmoet nieuwe mensen in Uithoorn' },
  { className: 'secondlife', title: ['Second', 'Life Market'], subtitle: 'buy · sell · reuse' },
  { className: 'football', title: ['Kids', 'Football Day'], subtitle: 'play · learn · belong' },
  { className: 'flowers', title: ['Flower', 'Workshop'], subtitle: 'create · learn · take home' },
];
const eventNames = ['Uithoorn Local Market', 'Sunset Walk aan de Amstel', 'Coffee & Connect', 'Second Life Market', 'Kids Football Day', 'Flower Workshop'];
const dates = ['Za 14 sep', 'Vr 20 sep', 'Di 24 sep', 'Zo 29 sep', 'Za 28 sep', 'Wo 25 sep'];

export function HomePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Alles');
  const [mobileOpen, setMobileOpen] = useState(false);
  const filteredBusinesses = useMemo(() => businesses.filter((item) => `${item.name} ${item.type} ${item.desc}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return <main className="wk-app" id="top">
    <aside className="side-rail">
      <a className="wk-logo" href="#top" aria-label="Uithoorn.online home"><span className="logo-u">u</span><span>ithoorn<span className="logo-dot">.online</span></span><small>ontmoet · ontdek · beleef</small></a>
      <nav className="side-nav" aria-label="Hoofdnavigatie">
        <a className="active" href="#explore"><span className="nav-circle">◉</span>Explore</a>
        <a href="#events"><CalendarDays /> Evenementen</a><a href="#classifieds"><Tag /> Te koop</a><a href="#businesses"><Store /> Bedrijven</a><a href="#groups"><Users /> Groepen</a><a href="#business"><Wrench /> Diensten</a><a href="#profile"><CircleUserRound /> Profiel</a>
      </nav>
      <div className="side-bottom"><a className="create-btn" href="#business"><span>＋</span> Plaats iets</a><a className="more-link" href="#footer"><Menu /> Meer</a></div>
    </aside>

    <div className="wk-content">
      <header className="topbar">
        <div className="mobile-brand"><a className="wk-logo" href="#top"><span className="logo-u">u</span><span>ithoorn<span className="logo-dot">.online</span></span></a></div>
        <nav className="category-nav" aria-label="Categorieën">{navCategories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</nav>
        <div className="top-actions"><span className="location"><MapPin /> Uithoorn</span><a href="#profile" className="signin">Inloggen</a><a href="#business" className="signup">Plaats iets</a><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">{mobileOpen ? <X /> : <Menu />}</button></div>
      </header>
      {mobileOpen && <nav className="mobile-nav"><a href="#explore">Explore</a><a href="#events">Evenementen</a><a href="#businesses">Bedrijven</a><a href="#classifieds">Te koop</a><a href="#business">Diensten</a></nav>}

      <div className="workspace">
        <section className="feed" id="explore">
          <div className="search-row"><div className="site-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek evenementen, bedrijven, items…" aria-label="Zoeken" /></div></div>
          <div className="feed-heading"><div><h1>dit gebeurt er <span>deze maand.</span></h1><p>Lokale dingen om te doen, te ontdekken en aan mee te doen.</p></div><a href="#events">Alles bekijken <ChevronRight /></a></div>

          <div className="highlight-grid" id="events">
            {visualCards.map((card, index) => { const event = events[index % events.length]; return <article className={`highlight-card ${card.className}`} key={card.className}>
              <div className="visual"><div className="visual-copy"><strong>{card.title.map((line) => <span key={line}>{line}</span>)}</strong><small>{card.subtitle}</small></div><div className="event-pill"><span>◫</span>{dates[index]}<br /><span>◷</span>{index % 2 === 0 ? '10:00 – 16:00' : '19:00 – 21:00'}<br /><span>⌖</span>{event[1].split(' · ')[1]}</div></div>
              <div className="card-meta"><span className="organizer"><i /> {index % 2 === 0 ? 'Uithoorn Lokaal' : 'Uithoorn Community'}</span><h2>{eventNames[index]}</h2><p><MapPin /> {event[1].split(' · ')[1]}</p><strong className="price">{index === 2 || index === 5 ? '€12,50' : 'Gratis'}</strong></div>
            </article>; })}
          </div>

          <section className="community-strip" id="groups"><div><span className="mini-kicker">Lokaal & dichtbij</span><h2>Niet alleen kijken.<br /><em>Meedoen.</em></h2><p>Vind mensen, activiteiten en plekken die passen bij jouw buurt en interesses.</p></div><div className="community-illustration"><span>UITHOORN</span><div className="bridge" /></div></section>

          <section className="business-preview" id="businesses"><div className="feed-heading compact"><div><span className="mini-kicker">Lokaal gevonden</span><h2>Bedrijven waar je op kunt rekenen.</h2></div><a href="#business">Bekijk alles <ChevronRight /></a></div><div className="business-row">{filteredBusinesses.slice(0, 3).map((item) => <article className="business-tile" key={item.name}><div className="tile-art"><span>{item.tag}</span><b>{item.name.slice(0, 1)}</b></div><div><small>{item.type}</small><h3>{item.name}</h3><p>{item.desc}</p></div></article>)}</div></section>
        </section>

        <aside className="right-rail">
          <div className="rail-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek in Uithoorn…" /></div>
          <section className="people-card"><h2>vind jouw mensen<br />offline.</h2><p>Ontdek evenementen, lokale bedrijven en communities in Uithoorn.</p><a href="#profile" className="rail-cta">Aanmelden</a><a href="#profile" className="rail-signin">Inloggen</a></section>
          <section className="popular"><small>POPULAIRE CATEGORIEËN</small>{[['Evenementen','Wat gebeurt er in Uithoorn?','event'],['Te koop','Koop & verkoop lokaal','sale'],['Diensten','Vind betrouwbare hulp','service'],['Groepen','Ontmoet mensen uit de buurt','group'],['Eten & drinken','Cafés, restaurants en meer','food'],['Sport','Samen actief blijven','sport']].map(([name, desc, type]) => <a href="#events" key={name} className="popular-item"><span className={`popular-icon ${type}`}>{type === 'event' ? '▣' : type === 'sale' ? '◇' : type === 'service' ? '✣' : type === 'group' ? '♧' : type === 'food' ? '⌂' : '○'}</span><span><b>{name}</b><small>{desc}</small></span></a>)}</section>
          <section className="rail-local"><div className="leaf">✦</div><h3>Samen sterker<br />in Uithoorn.</h3><p>Ontdek wat er om de hoek gebeurt. Deel iets met je buurt.</p></section>
        </aside>
      </div>
    </div>
    <footer id="footer" className="wk-footer"><span>Uithoorn.online</span><span>Lokale mensen. Echte verbindingen.</span><span>Uithoorn · De Kwakel · Nes aan de Amstel</span></footer>
  </main>;
}
