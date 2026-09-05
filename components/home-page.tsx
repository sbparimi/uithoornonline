'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, MapPin, Menu, Search, Sparkles, Wrench, X } from 'lucide-react';
import { businesses, workshops } from '../data';

const nav = [['Diensten', 'services'], ['Workshops', 'workshops'], ['Indian food', 'food']] as const;
const serviceHighlights = [
  { title: 'Klus & onderhoud', text: 'Schilderen, timmeren, handyman en kleine reparaties.', mark: '01' },
  { title: 'Schoonmaak & hulp', text: 'Huishoudelijke hulp, ramen en specialistische reiniging.', mark: '02' },
  { title: 'Techniek & installatie', text: 'Elektrische installatie en praktische technische hulp.', mark: '03' },
];

function scrollToSection(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

export function HomePage() {
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const businessResults = useMemo(() => businesses.filter((item) => `${item.name} ${item.type} ${item.desc}`.toLowerCase().includes(q)), [q]);
  const workshopResults = useMemo(() => workshops.filter((item) => `${item.title} ${item.provider} ${item.meta} ${item.description}`.toLowerCase().includes(q)), [q]);
  const foodMatch = q && ['indian', 'food', 'dosa', 'idli', 'vada', 'biryani', 'spiceindia'].some((term) => q.includes(term));
  const total = q ? businessResults.length + workshopResults.length + (foodMatch ? 1 : 0) : 0;

  return <main className="uo-site" id="top">
    <header className="uo-header">
      <div className="uo-header-inner">
        <a href="#top" className="uo-brand" aria-label="Uithoorn.online home"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a>
        <nav className="uo-nav" aria-label="Hoofdnavigatie"><button onClick={() => scrollToSection('explore')}>Ontdek</button>{nav.map(([label, id]) => <button key={id} onClick={() => scrollToSection(id)}>{label}</button>)}</nav>
        <div className="uo-header-actions"><span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span><a className="uo-header-cta" href="/request">Plaats je bedrijf</a><button className="uo-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" aria-expanded={mobileOpen}>{mobileOpen ? <X /> : <Menu />}</button></div>
      </div>
      {mobileOpen && <nav className="uo-mobile-nav" aria-label="Mobiele navigatie"><button onClick={() => { scrollToSection('explore'); setMobileOpen(false); }}>Ontdek</button>{nav.map(([label, id]) => <button key={id} onClick={() => { scrollToSection(id); setMobileOpen(false); }}>{label}</button>)}<a href="/businesses">Lokale aanbieders</a><a href="/request">Plaats je bedrijf</a></nav>}
    </header>

    <section className="uo-hero" id="explore">
      <div className="uo-hero-copy"><div className="uo-eyebrow"><MapPin /> Uithoorn & De Kwakel</div><h1>Vind iets<br /><em>lokaal.</em></h1><p>Lokale diensten, workshops en Indiaas eten. Zonder omwegen.</p></div>
      <div className="uo-search-wrap"><div className="uo-search" role="search"><Search aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Wat zoek je? Bijvoorbeeld klus, keramiek of biryani" aria-label="Zoek lokaal in Uithoorn" />{q && <button onClick={() => setQuery('')} aria-label="Zoekopdracht wissen"><X /></button>}</div><div className="uo-search-hints"><span>Populair</span><button onClick={() => setQuery('klus')}>klus</button><button onClick={() => setQuery('keramiek')}>keramiek</button><button onClick={() => setQuery('biryani')}>biryani</button></div></div>
    </section>

    {q ? <section className="uo-results" aria-live="polite"><div className="uo-section-head"><div><span className="uo-kicker">Zoekresultaten</span><h2>{total} lokale resultaten</h2></div><button onClick={() => setQuery('')} className="uo-text-button">Toon alles <ArrowRight /></button></div>{total === 0 ? <div className="uo-empty"><Search /><h3>Niets gevonden</h3><p>Probeer een dienst, workshop of “biryani”.</p></div> : <div className="uo-result-groups">
      {businessResults.length > 0 && <div><div className="uo-result-label">Lokale aanbieders <b>{businessResults.length}</b></div><div className="uo-card-grid">{businessResults.map((item) => <article className="uo-card" key={item.name}><div className="uo-card-symbol">{item.name.slice(0, 1)}</div><div className="uo-card-body"><span>{item.type}</span><h3>{item.name}</h3><p>{item.desc}</p><a href="/businesses">Bekijk aanbieder <ArrowRight /></a></div></article>)}</div></div>}
      {workshopResults.length > 0 && <div><div className="uo-result-label">Workshops & cursussen <b>{workshopResults.length}</b></div><div className="uo-list">{workshopResults.map((item) => <article key={item.title}><div><span>{item.provider}</span><h3>{item.title}</h3><p>{item.description}</p></div><strong>{item.meta}</strong></article>)}</div></div>}
      {foodMatch && <div><div className="uo-result-label">Indian food <b>1</b></div><article className="uo-food-feature"><div><span>SPICEINDIA</span><h3>South Indian food in Uithoorn</h3><p>Andhra-style biryani · dosa · idli · vada</p></div><a href="https://www.spiceindia.nl/">Bekijk menu <ArrowRight /></a></article></div>}
    </div>}</section> : <>
      <section className="uo-section" id="services"><div className="uo-section-head"><div><span className="uo-kicker">01 · Diensten</span><h2>Hulp nodig? Vind iemand dichtbij.</h2></div><a href="/services">Alle diensten <ArrowRight /></a></div><div className="uo-service-grid">{serviceHighlights.map((item) => <article key={item.mark}><span className="uo-number">{item.mark}</span><Wrench /><h3>{item.title}</h3><p>{item.text}</p><a href="/businesses">Vind een aanbieder <ArrowRight /></a></article>)}</div></section>
      <section className="uo-section" id="workshops"><div className="uo-section-head"><div><span className="uo-kicker">02 · Workshops</span><h2>Leer iets nieuws. Maak iets zelf.</h2></div><a href="/workshops">Alle workshops <ArrowRight /></a></div><div className="uo-workshop-grid">{workshops.slice(0, 3).map((item, index) => <article key={item.title}><div className={`uo-workshop-art art-${index + 1}`}><span>{String(index + 1).padStart(2, '0')}</span><Sparkles /></div><div className="uo-card-body"><span>{item.provider}</span><h3>{item.title}</h3><p>{item.description}</p><small><MapPin /> {item.meta}</small><a href="/workshops">Bekijk workshop <ArrowRight /></a></div></article>)}</div></section>
      <section className="uo-section" id="food"><div className="uo-section-head"><div><span className="uo-kicker">03 · Indian food</span><h2>Indiaas eten, lokaal ontdekt.</h2></div><a href="https://www.spiceindia.nl/">SpiceIndia <ArrowRight /></a></div><article className="uo-food-feature uo-spice"><div><span>SPICEINDIA · UITHOORN</span><h3>South Indian food,<br /><em>vers bereid.</em></h3><p>Andhra-style biryani · dosa · idli · vada</p><small><MapPin /> Uithoorn · takeaway</small></div><a href="https://www.spiceindia.nl/">Bekijk menu <ArrowRight /></a></article><div className="uo-business-invite"><div><span className="uo-kicker">Voor lokale food businesses</span><h3>Ook zichtbaar worden bij lokale klanten?</h3><p>Uithoorn.online is open voor lokale Indian food businesses.</p></div><a href="/request">List your business here <ArrowRight /></a></div></section>
      <section className="uo-section uo-providers" id="providers"><div className="uo-section-head"><div><span className="uo-kicker">Lokale aanbieders</span><h2>Van klus tot techniek.</h2></div><a href="/businesses">Volledige gids <ArrowRight /></a></div><div className="uo-provider-list">{businesses.filter((item) => item.name !== 'SpiceIndia').slice(0, 4).map((item) => <a href="/businesses" key={item.name}><span>{item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{item.type}</small></div><ArrowRight /></a>)}</div></section>
    </>}

    <section className="uo-business-cta"><div><span className="uo-kicker">Voor lokale ondernemers</span><h2>Sta waar je<br /><em>gevonden wordt.</em></h2><p>Bereik mensen in Uithoorn en De Kwakel die lokaal zoeken.</p></div><a href="/request">Plaats je bedrijf <ArrowRight /></a></section>
    <footer className="uo-footer"><a href="#top" className="uo-brand"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer>
  </main>;
}
