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

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function HomePage() {
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const businessResults = useMemo(() => businesses.filter((item) => `${item.name} ${item.type} ${item.desc}`.toLowerCase().includes(q)), [q]);
  const workshopResults = useMemo(() => workshops.filter((item) => `${item.title} ${item.provider} ${item.meta} ${item.description}`.toLowerCase().includes(q)), [q]);
  const foodMatch = q && ['indian', 'food', 'dosa', 'idli', 'vada', 'biryani', 'spiceindia'].some((term) => q.includes(term));
  const total = q ? businessResults.length + workshopResults.length + (foodMatch ? 1 : 0) : 0;

  return (
    <main className="uo-site" id="top">
      <header className="uo-header">
        <div className="uo-header-inner">
          <a href="#top" className="uo-brand" aria-label="Uithoorn.online home">
            <span className="uo-brand-mark" aria-hidden="true"><img src="/icon.svg" alt="" /></span>
            <span className="uo-brand-wordmark">uithoorn<span>.online</span></span>
            <small className="uo-brand-tagline">Lokaal in Uithoorn</small>
          </a>
          <nav className="uo-nav" aria-label="Hoofdnavigatie">
            <button onClick={() => scrollToSection('explore')}>Ontdek</button>
            {nav.map(([label, id]) => <button key={id} onClick={() => scrollToSection(id)}>{label}</button>)}
          </nav>
          <div className="uo-header-actions">
            <span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span>
            <a className="uo-header-cta" href="/signup">Word aanbieder</a>
            <button className="uo-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" aria-expanded={mobileOpen}>{mobileOpen ? <X /> : <Menu />}</button>
          </div>
        </div>
        {mobileOpen && <nav className="uo-mobile-nav" aria-label="Mobiele navigatie">
          <button onClick={() => { scrollToSection('explore'); setMobileOpen(false); }}>Ontdek</button>
          {nav.map(([label, id]) => <button key={id} onClick={() => { scrollToSection(id); setMobileOpen(false); }}>{label}</button>)}
          <a href="/businesses">Lokale aanbieders</a>
          <a href="/signup">Word aanbieder</a>
        </nav>}
      </header>

      <section className="uo-hero" id="explore">
        <div className="uo-hero-copy">
          <div className="uo-eyebrow"><MapPin /> Uithoorn & De Kwakel</div>
          <h1>Alles lokaal.<br /><em>Alles dichtbij.</em></h1>
          <p>Ontdek betrouwbare lokale diensten, workshops en Indiaas eten — geselecteerd voor Uithoorn en De Kwakel.</p>
          <div className="uo-hero-links"><a href="/services">Vind een dienst <ArrowRight /></a><a href="/workshops">Ontdek workshops <ArrowRight /></a></div>
        </div>
        <div className="uo-search-wrap">
          <div className="uo-search-label">ZOEK LOKAAL</div>
          <div className="uo-search" role="search"><Search aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Wat zoek je? Bijvoorbeeld klus, keramiek of biryani" aria-label="Zoek lokaal in Uithoorn" />{q && <button onClick={() => setQuery('')} aria-label="Zoekopdracht wissen"><X /></button>}</div>
          <div className="uo-search-hints"><span>Populair</span><button onClick={() => setQuery('klus')}>klus</button><button onClick={() => setQuery('keramiek')}>keramiek</button><button onClick={() => setQuery('biryani')}>biryani</button></div>
          <div className="uo-search-note"><span>Lokale ontdekking</span><strong>Uithoorn + De Kwakel</strong></div>
        </div>
      </section>

      <section className="uo-platform-strip" aria-label="Uithoorn.online aanbod">
        <div><span>01</span><strong>Lokale diensten</strong><small>Vind hulp dichtbij</small></div>
        <div><span>02</span><strong>Workshops & cursussen</strong><small>Leer lokaal</small></div>
        <div><span>03</span><strong>Indian food</strong><small>Ontdek lokaal eten</small></div>
        <div><span>04</span><strong>Lokale aanbieders</strong><small>Word zichtbaar</small></div>
      </section>

      {q ? <section className="uo-results" aria-live="polite"><div className="uo-section-head"><div><span className="uo-kicker">Zoekresultaten</span><h2>{total} lokale resultaten</h2></div><button onClick={() => setQuery('')} className="uo-text-button">Toon alles <ArrowRight /></button></div>{total === 0 ? <div className="uo-empty"><Search /><h3>Niets gevonden</h3><p>Probeer een dienst, workshop of “biryani”.</p></div> : <div className="uo-result-groups">{businessResults.length > 0 && <div><div className="uo-result-label">Lokale aanbieders <b>{businessResults.length}</b></div><div className="uo-card-grid">{businessResults.map((item) => <article className="uo-card" key={item.name}><div className="uo-card-symbol">{item.name.slice(0, 1)}</div><div className="uo-card-body"><span>{item.type}</span><h3>{item.name}</h3><p>{item.desc}</p><a href="/businesses">Bekijk aanbieder <ArrowRight /></a></div></article>)}</div></div>}{workshopResults.length > 0 && <div><div className="uo-result-label">Workshops & cursussen <b>{workshopResults.length}</b></div><div className="uo-list">{workshopResults.map((item) => <article key={item.title}><div><span>{item.provider}</span><h3>{item.title}</h3><p>{item.description}</p></div><strong>{item.meta}</strong></article>)}</div></div>}{foodMatch && <div><div className="uo-result-label">Indian food <b>1</b></div><article className="uo-food-feature uo-spice"><div><span>SPICEINDIA</span><h3>South Indian food in Uithoorn</h3><p>Andhra-style biryani · dosa · idli · vada</p></div><a href="https://www.spiceindia.nl/">Bekijk menu <ArrowRight /></a></article></div>}</div>}</section> : <>
        <section className="uo-section uo-intro-section">
          <div className="uo-section-head"><div><span className="uo-kicker">WAT JE HIER VINDT</span><h2>Een lokale plek om<br /><em>te ontdekken.</em></h2></div><p className="uo-section-lead">Uithoorn.online brengt wat er in je buurt gebeurt samen in één eenvoudige, moderne plek.</p></div>
          <div className="uo-service-grid">{serviceHighlights.map((item) => <article key={item.mark}><span className="uo-number">{item.mark}</span><Wrench /><h3>{item.title}</h3><p>{item.text}</p><a href="/businesses">Vind een aanbieder <ArrowRight /></a></article>)}</div>
        </section>

        <section className="uo-proof-section" aria-labelledby="local-proof-title">
          <div className="uo-proof-inner">
            <div><span className="uo-kicker">LOKAAL, IN ÉÉN OVERZICHT</span><h2 id="local-proof-title">Van zoeken naar<br /><em>vinden.</em></h2></div>
            <div className="uo-proof-copy"><p>Geen eindeloze zoekresultaten. Geen onduidelijke platforms. Alleen lokale categorieën, aanbieders en activiteiten die relevant zijn voor Uithoorn en De Kwakel.</p><a href="/businesses">Bekijk lokale aanbieders <ArrowRight /></a></div>
          </div>
          <div className="uo-proof-pillars">
            <article><strong>01</strong><h3>Lokale diensten</h3><p>Vind betrouwbare hulp dichtbij huis.</p></article>
            <article><strong>02</strong><h3>Workshops & cursussen</h3><p>Leer en maak iets nieuws in je eigen omgeving.</p></article>
            <article><strong>03</strong><h3>Indian food</h3><p>Ontdek lokaal bereid Indiaas eten.</p></article>
            <article><strong>04</strong><h3>Lokale ondernemers</h3><p>Vind en ondersteun ondernemers uit Uithoorn en De Kwakel.</p></article>
          </div>
        </section>

        <section className="uo-section" id="workshops"><div className="uo-section-head"><div><span className="uo-kicker">02 · WORKSHOPS</span><h2>Leer iets nieuws.<br /><em>Maak iets zelf.</em></h2></div><a href="/workshops">Alle workshops <ArrowRight /></a></div><div className="uo-workshop-grid">{workshops.slice(0, 3).map((item, index) => <article key={item.title}><div className={`uo-workshop-art art-${index + 1}`}><span>{String(index + 1).padStart(2, '0')}</span><Sparkles /></div><div className="uo-card-body"><span>{item.provider}</span><h3>{item.title}</h3><p>{item.description}</p><small><MapPin /> {item.meta}</small><a href="/workshops">Bekijk workshop <ArrowRight /></a></div></article>)}</div></section>

        <section className="uo-feature-section"><div className="uo-feature-copy"><span className="uo-kicker">03 · INDIAN FOOD</span><h2>Lokale smaak.<br /><em>Vers bereid.</em></h2><p>Ontdek Indian food in Uithoorn met één duidelijke lokale bestemming.</p><a href="https://www.spiceindia.nl/">Ontdek SpiceIndia <ArrowRight /></a></div><div className="uo-feature-visual"><span>SPICEINDIA</span><strong>South Indian<br />food</strong><small>Uithoorn · takeaway</small></div></section>

        <section className="uo-section uo-providers" id="providers"><div className="uo-section-head"><div><span className="uo-kicker">LOKALE AANBIEDERS</span><h2>Van klus tot techniek.</h2></div><a href="/businesses">Volledige gids <ArrowRight /></a></div><div className="uo-provider-list">{businesses.filter((item) => item.name !== 'SpiceIndia').slice(0, 4).map((item) => <a href="/businesses" key={item.name}><span>{item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{item.type}</small></div><ArrowRight /></a>)}</div></section>

        <section className="uo-editorial"><div className="uo-editorial-head"><span className="uo-kicker">WAAROM UITHOORN.ONLINE</span><h2>Gemaakt voor lokaal ontdekken.</h2></div><div className="uo-editorial-grid"><article><span>01</span><h3>Relevant</h3><p>Een focus op Uithoorn en De Kwakel, zodat lokale zoekopdrachten ook echt lokaal blijven.</p></article><article><span>02</span><h3>Eenvoudig</h3><p>Zoeken, ontdekken en doorklikken zonder een ingewikkelde marketplace-interface.</p></article><article><span>03</span><h3>Open voor lokaal</h3><p>Lokale ondernemers krijgen een duidelijke plek om zichtbaar te worden bij hun eigen doelgroep.</p></article></div></section>
      </>}

      <section className="uo-business-cta"><div><span className="uo-kicker">VOOR LOKALE ONDERNEMERS</span><h2>Sta waar je<br /><em>gevonden wordt.</em></h2><p>Bereik mensen in Uithoorn en De Kwakel die lokaal zoeken.</p></div><a href="/signup">Word aanbieder <ArrowRight /></a></section>
      <footer className="uo-footer"><a href="#top" className="uo-brand"><span className="uo-brand-mark" aria-hidden="true"><img src="/icon.svg" alt="" /></span><span className="uo-brand-wordmark">uithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer>
    </main>
  );
}
