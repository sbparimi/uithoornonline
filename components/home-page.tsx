'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, CircleUserRound, MapPin, Menu, Search, Store, Wrench, X } from 'lucide-react';
import { businesses, foodSpots, services, workshops } from '../data';

const navCategories = ['Ontdek', 'Diensten', 'Workshops', 'Indian food', 'Klus & onderhoud', 'Beauty & wellness', 'Creatief'];

const serviceCards = [
  { className: 'market', title: ['Klus', '& onderhoud'], subtitle: 'schilderen · timmeren · handyman' },
  { className: 'walk', title: ['Schoonmaak', '& hulp'], subtitle: 'thuis · ramen · onderhoud' },
  { className: 'coffee', title: ['Elektricien', 'Uithoorn'], subtitle: 'installatie · techniek · reparatie' },
];

const workshopCards = [
  { className: 'secondlife', title: ['Keramiek', '& klei'], subtitle: 'maken · leren · meenemen' },
  { className: 'flowers', title: ['Kunst', '& creatief'], subtitle: 'schilderen · tekenen · fotografie' },
  { className: 'football', title: ['Edelsmeden', '& maken'], subtitle: 'sieraden · vakmanschap · cursus' },
];

export function HomePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Ontdek');
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredBusinesses = useMemo(() => businesses.filter((item) => `${item.name} ${item.type} ${item.desc}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const filteredFood = useMemo(() => foodSpots.filter((item) => `${item.name} ${item.type} ${item.highlight}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return <main className="wk-app" id="top">
    <aside className="side-rail">
      <a className="wk-logo" href="#top" aria-label="Uithoorn.online home"><span className="logo-u">u</span><span>ithoorn<span className="logo-dot">.online</span></span><small>ontdek · lokaal · dichtbij</small></a>
      <nav className="side-nav" aria-label="Hoofdnavigatie">
        <a className="active" href="#explore"><span className="nav-circle">◉</span>Ontdek</a>
        <a href="#services"><Wrench /> Diensten</a>
        <a href="#workshops"><Store /> Workshops</a>
        <a href="#food"><span className="nav-circle">◈</span>Indian food</a>
        <a href="#businesses"><CircleUserRound /> Lokale aanbieders</a>
      </nav>
      <div className="side-bottom"><a className="create-btn" href="#for-business"><span>＋</span> Voeg bedrijf toe</a><a className="more-link" href="#footer"><Menu /> Meer</a></div>
    </aside>

    <div className="wk-content">
      <header className="topbar">
        <div className="mobile-brand"><a className="wk-logo" href="#top"><span className="logo-u">u</span><span>ithoorn<span className="logo-dot">.online</span></span></a></div>
        <nav className="category-nav" aria-label="Categorieën">{navCategories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</nav>
        <div className="top-actions"><span className="location"><MapPin /> Uithoorn</span><a href="#businesses" className="signin">Aanbieders</a><a href="#for-business" className="signup">Voeg bedrijf toe</a><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">{mobileOpen ? <X /> : <Menu />}</button></div>
      </header>
      {mobileOpen && <nav className="mobile-nav"><a href="#services">Diensten</a><a href="#workshops">Workshops</a><a href="#food">Indian food</a><a href="#businesses">Aanbieders</a></nav>}

      <div className="workspace">
        <section className="feed" id="explore">
          <div className="search-row"><div className="site-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek diensten, workshops, Indian food…" aria-label="Zoeken" /></div></div>
          <div className="feed-heading"><div><h1>lokaal gevonden <span>in Uithoorn.</span></h1><p>Praktische hulp, workshops en plekken voor goed Indiaas eten.</p></div><a href="#services">Alles ontdekken <ArrowRight /></a></div>

          <section id="services" className="focus-section">
            <div className="feed-heading compact"><div><span className="mini-kicker">Diensten</span><h2>Hulp nodig? Vind iemand dichtbij.</h2></div><a href="#businesses">Aanbieders <ArrowRight /></a></div>
            <div className="highlight-grid service-grid">
              {serviceCards.map((card, index) => { const service = services[index]; return <article className={`highlight-card ${card.className}`} key={card.className}>
                <div className="visual"><div className="visual-copy"><strong>{card.title.map((line) => <span key={line}>{line}</span>)}</strong><small>{card.subtitle}</small></div><div className="event-pill"><span>⌖</span>Uithoorn<br /><span>→</span>Lokale aanbieders</div></div>
                <div className="card-meta"><span className="organizer"><i /> Lokaal aanbod</span><h2>{service.title}</h2><p>{service.description}</p></div>
              </article>; })}
            </div>
          </section>

          <section id="workshops" className="focus-section">
            <div className="feed-heading compact"><div><span className="mini-kicker">Workshops & cursussen</span><h2>Leer iets nieuws. Maak iets zelf.</h2></div><a href="#workshops-list">Bekijk workshops <ArrowRight /></a></div>
            <div className="highlight-grid workshop-grid">
              {workshopCards.map((card, index) => { const workshop = workshops[index]; return <article className={`highlight-card ${card.className}`} key={card.className}>
                <div className="visual"><div className="visual-copy"><strong>{card.title.map((line) => <span key={line}>{line}</span>)}</strong><small>{card.subtitle}</small></div><div className="event-pill"><span>◫</span>{workshop.meta}</div></div>
                <div className="card-meta"><span className="organizer"><i /> {workshop.provider}</span><h2>{workshop.title}</h2><p>{workshop.description}</p></div>
              </article>; })}
            </div>
          </section>

          <section id="food" className="food-section">
            <div className="feed-heading compact"><div><span className="mini-kicker">Indian food hotspots</span><h2>Indiaas eten, lokaal ontdekt.</h2></div><a href="#food-list">Alle hotspots <ArrowRight /></a></div>
            <div id="food-list" className="food-row">{filteredFood.map((item) => <article className="food-tile" key={item.name}><div className="food-art"><span>{item.tag}</span><b>✦</b></div><div><small>{item.type}</small><h3>{item.name}</h3><p>{item.highlight}</p><em><MapPin /> {item.meta}</em></div></article>)}</div>
          </section>

          <section id="businesses" className="business-preview"><div className="feed-heading compact"><div><span className="mini-kicker">Lokale aanbieders</span><h2>Van klus tot beauty.</h2></div><a href="#for-business">Word zichtbaar <ArrowRight /></a></div><div className="business-row">{filteredBusinesses.slice(0, 4).map((item) => <article className="business-tile" key={item.name}><div className="tile-art"><span>{item.tag}</span><b>{item.name.slice(0, 1)}</b></div><div><small>{item.type}</small><h3>{item.name}</h3><p>{item.desc}</p></div></article>)}</div></section>

          <section id="for-business" className="community-strip"><div><span className="mini-kicker">Voor lokale ondernemers</span><h2>Sta waar je<br /><em>gevonden wordt.</em></h2><p>Laat Uithoorn weten wat je aanbiedt. Diensten, workshops en lokale food spots op één plek.</p><a className="rail-cta" href="#businesses">Aanbieder worden</a></div><div className="community-illustration"><span>UITHOORN</span><div className="bridge" /></div></section>
        </section>

        <aside className="right-rail">
          <div className="rail-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek in Uithoorn…" /></div>
          <section className="people-card"><h2>wat zoek je<br />vandaag?</h2><p>Vind een lokale dienst, ontdek een workshop of kies waar je Indiaas wilt eten.</p><a href="#services" className="rail-cta">Diensten vinden</a><a href="#food" className="rail-signin">Indian food ontdekken</a></section>
          <section className="popular"><small>POPULAIR IN UITHOORN</small>{[['Diensten','Klus, schoonmaak & techniek','service'],['Workshops','Keramiek, kunst & creatief','workshop'],['Indian food','Biryani, dosa & curries','food'],['Beauty','Haar, beauty & wellness','beauty'],['Tuin & buiten','Hulp rondom het huis','garden'],['Creatief','Maak, leer & ontdek','creative']].map(([name, desc, type]) => <a href={type === 'food' ? '#food' : type === 'workshop' || type === 'creative' ? '#workshops' : '#services'} key={name} className="popular-item"><span className={`popular-icon ${type}`}>{type === 'food' ? '✦' : type === 'workshop' ? '◇' : type === 'service' ? '✣' : type === 'beauty' ? '○' : type === 'garden' ? '❋' : '△'}</span><span><b>{name}</b><small>{desc}</small></span></a>)}</section>
          <section className="rail-local"><div className="leaf">✦</div><h3>Uithoorn,<br />om de hoek.</h3><p>Ontdek lokale mensen, vakmensen en smaken zonder verder te zoeken.</p></section>
        </aside>
      </div>
    </div>
    <footer id="footer" className="wk-footer"><span>Uithoorn.online</span><span>Diensten · Workshops · Indian food</span><span>Uithoorn · De Kwakel</span></footer>
  </main>;
}
