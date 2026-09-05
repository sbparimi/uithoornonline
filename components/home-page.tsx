'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, CircleUserRound, MapPin, Menu, Search, Store, Wrench, X } from 'lucide-react';
import { businesses, foodSpots, services, workshops } from '../data';

const navCategories = ['Ontdek', 'Diensten', 'Workshops', 'Indian food'];
const subCategories = ['Klus & onderhoud', 'Beauty & wellness', 'Creatief'];

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

const sectionForCategory: Record<string, string> = {
  Ontdek: 'explore',
  Diensten: 'services',
  Workshops: 'workshops',
  'Indian food': 'food',
  'Klus & onderhoud': 'businesses',
  'Beauty & wellness': 'businesses',
  Creatief: 'workshops',
};

export function HomePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Ontdek');
  const [mobileOpen, setMobileOpen] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredBusinesses = useMemo(() => businesses.filter((item) => `${item.name} ${item.type} ${item.desc}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery]);
  const filteredFood = useMemo(() => foodSpots.filter((item) => `${item.name} ${item.type} ${item.highlight}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery]);
  const filteredWorkshops = useMemo(() => workshops.filter((item) => `${item.title} ${item.provider} ${item.meta} ${item.description}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery]);

  const resultCount = filteredBusinesses.length + filteredFood.length + filteredWorkshops.length;
  const hasSearch = normalizedQuery.length > 0;

  const goTo = (name: string) => {
    setCategory(name);
    setMobileOpen(false);
    document.getElementById(sectionForCategory[name] ?? 'explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <main className="wk-app" id="top">
    <aside className="side-rail">
      <a className="wk-logo" href="#top" aria-label="Uithoorn.online home"><span className="logo-u">u</span><span>ithoorn<span className="logo-dot">.online</span></span><small>ontdek · lokaal · dichtbij</small></a>
      <nav className="side-nav" aria-label="Hoofdnavigatie">
        <button type="button" className={category === 'Ontdek' ? 'active' : ''} onClick={() => goTo('Ontdek')}><span className="nav-circle">◉</span>Ontdek</button>
        <button type="button" className={category === 'Diensten' ? 'active' : ''} onClick={() => goTo('Diensten')}><Wrench /> Diensten</button>
        <button type="button" className={category === 'Workshops' ? 'active' : ''} onClick={() => goTo('Workshops')}><Store /> Workshops</button>
        <button type="button" className={category === 'Indian food' ? 'active' : ''} onClick={() => goTo('Indian food')}><span className="nav-circle">◈</span>Indian food</button>
        <a href="/businesses"><CircleUserRound /> Lokale aanbieders</a>
      </nav>
      <div className="side-bottom"><a className="create-btn" href="#for-business"><span>＋</span> Voeg bedrijf toe</a><a className="more-link" href="#footer"><Menu /> Meer</a></div>
    </aside>

    <div className="wk-content">
      <header className="topbar">
        <div className="mobile-brand"><a className="wk-logo" href="#top"><span className="logo-u">u</span><span>ithoorn<span className="logo-dot">.online</span></span></a></div>
        <nav className="category-nav" aria-label="Categorieën">{navCategories.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => goTo(item)}>{item}</button>)}</nav>
        <div className="top-actions"><span className="location"><MapPin /> Uithoorn</span><a href="/businesses" className="signin">Aanbieders</a><a href="#for-business" className="signup">Voeg bedrijf toe</a><button type="button" className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Menu sluiten' : 'Menu openen'} aria-expanded={mobileOpen}>{mobileOpen ? <X /> : <Menu />}</button></div>
      </header>
      {mobileOpen && <nav className="mobile-nav" aria-label="Mobiele navigatie">{[...navCategories, ...subCategories].map((item) => <button type="button" key={item} onClick={() => goTo(item)}>{item}</button>)}<a href="/businesses">Lokale aanbieders</a></nav>}

      <div className="workspace">
        <section className="feed" id="explore">
          <div className="hero-search" role="search">
            <Search aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Wat zoek je in Uithoorn? Bijvoorbeeld klus, keramiek of biryani" aria-label="Zoek lokaal in Uithoorn" />
            {hasSearch && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Zoekopdracht wissen">Wissen</button>}
          </div>

          <div className="feed-heading hero-heading"><div><div className="hero-kicker"><MapPin /> Uithoorn & De Kwakel</div><h1>lokaal gevonden <span>in Uithoorn.</span></h1><p>Vind hulp, leer iets nieuws of ontdek waar je Indiaas kunt eten.</p></div><a href="/businesses">Alle aanbieders <ArrowRight /></a></div>

          <div className="quick-actions" aria-label="Snel naar een categorie">
            <button type="button" onClick={() => goTo('Diensten')}><Wrench /> Hulp & diensten</button>
            <button type="button" onClick={() => goTo('Workshops')}><Store /> Workshops</button>
            <button type="button" onClick={() => goTo('Indian food')}><span>✦</span> Indian food</button>
          </div>

          {hasSearch ? <>
            <section className="search-summary" aria-live="polite"><div><strong>{resultCount}</strong> lokale resultaten voor <b>“{query}”</b></div><button type="button" onClick={() => setQuery('')}>Toon alles</button></section>
            {resultCount === 0 ? <section className="empty-search"><Search /><h2>Niets gevonden</h2><p>Probeer bijvoorbeeld <button type="button" onClick={() => setQuery('klus')}>klus</button>, <button type="button" onClick={() => setQuery('keramiek')}>keramiek</button> of <button type="button" onClick={() => setQuery('biryani')}>biryani</button>.</p></section> : <section className="search-results" aria-label="Zoekresultaten">
              {filteredBusinesses.length > 0 && <div className="result-group"><div className="result-heading"><span>Lokale aanbieders</span><b>{filteredBusinesses.length}</b></div><div className="result-grid">{filteredBusinesses.map((item) => <article className="business-tile" key={`business-${item.name}`}><div className="tile-art"><span>{item.tag}</span><b>{item.name.slice(0, 1)}</b></div><div><small>{item.type}</small><h3>{item.name}</h3><p>{item.desc}</p><a className="tile-link" href="/businesses">Bekijk aanbieder <ArrowRight /></a></div></article>)}</div></div>}
              {filteredWorkshops.length > 0 && <div className="result-group"><div className="result-heading"><span>Workshops & cursussen</span><b>{filteredWorkshops.length}</b></div><div className="result-list">{filteredWorkshops.map((item) => <article className="result-row" key={`workshop-${item.title}`}><div><small>{item.provider}</small><h3>{item.title}</h3><p>{item.description}</p></div><span>{item.meta}</span></article>)}</div></div>}
              {filteredFood.length > 0 && <div className="result-group"><div className="result-heading"><span>Indian food</span><b>{filteredFood.length}</b></div><div className="result-grid">{filteredFood.map((item) => <article className="business-tile food-tile" key={`food-${item.name}`}><div className="tile-art food-art"><span>{item.tag}</span><b>✦</b></div><div><small>{item.type}</small><h3>{item.name}</h3><p>{item.highlight}</p><em><MapPin /> {item.meta}</em><a className="tile-link" href="/businesses">Bekijk aanbieder <ArrowRight /></a></div></article>)}</div></div>}
            </section>}
          </> : <>
            <section id="services" className="focus-section">
              <div className="feed-heading compact"><div><span className="mini-kicker">Diensten</span><h2>Hulp nodig? Vind iemand dichtbij.</h2></div><a href="/businesses">Alle aanbieders <ArrowRight /></a></div>
              <div className="highlight-grid service-grid">{serviceCards.map((card, index) => { const service = services[index]; return <article className={`highlight-card ${card.className}`} key={card.className}>
                <div className="visual"><div className="visual-copy"><strong>{card.title.map((line) => <span key={line}>{line}</span>)}</strong><small>{card.subtitle}</small></div><div className="event-pill"><span>⌖</span>Uithoorn<br /><span>→</span>Lokale aanbieders</div></div>
                <div className="card-meta"><span className="organizer"><i /> Lokaal aanbod</span><h2>{service.title}</h2><p>{service.description}</p><a className="card-link" href="/businesses">Bekijk aanbieders <ArrowRight /></a></div>
              </article>; })}</div>
            </section>

            <section id="workshops" className="focus-section">
              <div className="feed-heading compact"><div><span className="mini-kicker">Workshops & cursussen</span><h2>Leer iets nieuws. Maak iets zelf.</h2></div><a href="#workshops-list">Bekijk alles <ArrowRight /></a></div>
              <div id="workshops-list" className="highlight-grid workshop-grid">{workshopCards.map((card, index) => { const workshop = workshops[index]; return <article className={`highlight-card ${card.className}`} key={card.className}>
                <div className="visual"><div className="visual-copy"><strong>{card.title.map((line) => <span key={line}>{line}</span>)}</strong><small>{card.subtitle}</small></div><div className="event-pill"><span>◫</span>{workshop.meta}</div></div>
                <div className="card-meta"><span className="organizer"><i /> {workshop.provider}</span><h2>{workshop.title}</h2><p>{workshop.description}</p><a className="card-link" href="#workshops-list">Bekijk workshop <ArrowRight /></a></div>
              </article>; })}</div>
            </section>

            <section id="food" className="food-section">
              <div className="feed-heading compact"><div><span className="mini-kicker">Indian food hotspots</span><h2>Indiaas eten, lokaal ontdekt.</h2></div><a href="#food-list">Alle hotspots <ArrowRight /></a></div>
              <div id="food-list" className="food-row">{foodSpots.map((item) => <article className="business-tile food-tile" key={item.name}><div className="tile-art food-art"><span>{item.tag}</span><b>✦</b></div><div><small>{item.type}</small><h3>{item.name}</h3><p>{item.highlight}</p><em><MapPin /> {item.meta}</em><a className="tile-link" href="/businesses">Bekijk aanbieder <ArrowRight /></a></div></article>)}</div>
            </section>

            <section id="businesses" className="business-preview"><div className="feed-heading compact"><div><span className="mini-kicker">Lokale aanbieders</span><h2>Van klus tot techniek.</h2></div><a href="/businesses">Volledige gids <ArrowRight /></a></div><div className="business-row">{businesses.slice(0, 4).map((item) => <article className="business-tile" key={item.name}><div className="tile-art"><span>{item.tag}</span><b>{item.name.slice(0, 1)}</b></div><div><small>{item.type}</small><h3>{item.name}</h3><p>{item.desc}</p><a className="tile-link" href="/businesses">Bekijk aanbieder <ArrowRight /></a></div></article>)}</div></section>
          </>}

          <section id="for-business" className="community-strip"><div><span className="mini-kicker">Voor lokale ondernemers</span><h2>Sta waar je<br /><em>gevonden wordt.</em></h2><p>Wil je als lokale aanbieder zichtbaar zijn op Uithoorn.online? Laat je gegevens achter en vertel wat je aanbiedt.</p><a className="rail-cta" href="/request">Interesse tonen</a></div><div className="community-illustration"><span>UITHOORN</span><div className="bridge" /></div></section>
        </section>

        <aside className="right-rail">
          <section className="people-card"><span className="mini-kicker">Snel vinden</span><h2>Wat zoek je<br />vandaag?</h2><p>Kies direct wat je nodig hebt. Je kunt ook bovenaan zoeken.</p><button type="button" className="rail-cta" onClick={() => goTo('Diensten')}>Diensten vinden</button><button type="button" className="rail-secondary" onClick={() => goTo('Workshops')}>Workshops bekijken</button><button type="button" className="rail-secondary" onClick={() => goTo('Indian food')}>Indian food ontdekken</button></section>
          <section className="popular"><small>POPULAIR IN UITHOORN</small>{[['Diensten','Klus, schoonmaak & techniek','service'],['Workshops','Keramiek, kunst & creatief','service'],['Indian food','Biryani, dosa & curries','food'],['Beauty','Haar, beauty & wellness','service'],['Tuin & buiten','Hulp rondom het huis','service'],['Creatief','Maak, leer & ontdek','service']].map(([name, desc, type]) => <button type="button" onClick={() => goTo(name === 'Beauty' ? 'Beauty & wellness' : name)} key={name} className="popular-item"><span className={`popular-icon ${type}`}>{type === 'food' ? '✦' : name === 'Workshops' || name === 'Creatief' ? '◇' : name === 'Beauty' ? '○' : name === 'Tuin & buiten' ? '❋' : '✣'}</span><span><b>{name}</b><small>{desc}</small></span></button>)}</section>
          <section className="rail-local"><div className="leaf">✦</div><h3>Uithoorn,<br />om de hoek.</h3><p>Lokale mensen, vakmensen, workshops en smaken — zonder verder te zoeken.</p></section>
        </aside>
      </div>
    </div>
    <footer id="footer" className="wk-footer"><span>Uithoorn.online</span><span>Diensten · Workshops · Indian food</span><span>Uithoorn · De Kwakel</span></footer>
    <style>{`
      .side-nav button{border:0;background:none;text-align:left;font:inherit;cursor:pointer;width:100%}.hero-search{height:50px;border:1px solid #e6e7e4;border-radius:999px;display:flex;align-items:center;gap:10px;padding:0 15px;max-width:760px;margin:14px auto 0;box-shadow:0 5px 18px rgba(0,0,0,.035)}.hero-search svg{width:17px;color:#777}.hero-search input{border:0;outline:0;flex:1;min-width:0;font-size:12px;color:#222}.hero-search input::placeholder{color:#999}.clear-search{border:0;background:#f4f4f1;border-radius:99px;padding:6px 10px;font-size:9px;cursor:pointer}.hero-heading{margin-top:22px}.hero-kicker{display:flex;align-items:center;gap:5px;font-size:8px;color:#6d8b6d;font-weight:800;letter-spacing:.09em;text-transform:uppercase;margin-bottom:7px}.hero-kicker svg{width:11px}.quick-actions{display:flex;gap:8px;margin:0 0 25px}.quick-actions button{border:1px solid #e8e9e6;background:#fff;border-radius:999px;padding:8px 12px;font-size:9px;font-weight:750;cursor:pointer;display:flex;align-items:center;gap:6px}.quick-actions button:hover,.rail-secondary:hover{background:#f7f7f4}.search-summary{display:flex;align-items:center;justify-content:space-between;border:1px solid #e8e9e5;border-radius:12px;padding:11px 13px;margin:0 0 22px;background:#fbfbf9;font-size:10px}.search-summary strong{font-size:14px}.search-summary button,.empty-search button{border:0;background:none;text-decoration:underline;cursor:pointer;font-size:9px}.search-results{display:grid;gap:30px}.result-group{display:grid;gap:12px}.result-heading{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800}.result-heading b{display:grid;place-items:center;min-width:20px;height:20px;border-radius:99px;background:#f0f1ed;font-size:8px}.result-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.result-list{display:grid;gap:8px}.result-row{border:1px solid #ededeb;border-radius:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:18px;background:#fff}.result-row small{font-size:7px;color:#8f938f;text-transform:uppercase}.result-row h3{font-size:11px;margin:3px 0}.result-row p{font-size:8px;color:#929593;margin:0}.result-row>span{font-size:8px;color:#777;white-space:nowrap}.empty-search{border:1px dashed #dcded9;border-radius:15px;padding:25px;text-align:center;margin-bottom:28px}.empty-search svg{width:20px;color:#999}.empty-search h2{font-size:15px;margin:8px 0 5px}.empty-search p{font-size:10px;color:#888;margin:0}.focus-section{margin-top:42px}.focus-section:first-of-type{margin-top:0}.workshop-grid{margin-bottom:4px}.food-section{margin-top:45px}.food-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}.food-tile{min-width:0}.food-art{background:linear-gradient(140deg,#ffe4b9,#f6c17c)!important}.food-tile>div:last-child{padding:10px}.food-tile em{display:flex;align-items:center;gap:4px;margin-top:7px;font-style:normal;font-size:7px;color:#8b8f8b}.food-tile em svg{width:9px}.card-link,.tile-link{display:flex;align-items:center;gap:4px;width:max-content;margin-top:8px;font-size:8px;font-weight:800}.card-link svg,.tile-link svg{width:10px}.business-preview{padding-top:45px}.community-strip .rail-cta{width:max-content;padding:10px 16px;margin-top:12px}.popular-icon.service{background:#dff3df;color:#4c9a57}.popular-icon.food{background:#fff0c8;color:#d79512}.rail-secondary{width:100%;border:1px solid #ededeb;background:#fff;border-radius:99px;padding:9px;font-size:9px;font-weight:700;margin-top:7px;cursor:pointer}.people-card .mini-kicker{display:block;margin-bottom:8px}.popular-item{border:0;background:none;width:100%;cursor:pointer;text-align:left;padding:0}.popular-item:hover b{text-decoration:underline}@media(max-width:1100px){.food-row{grid-template-columns:repeat(2,minmax(0,1fr))}.result-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.hero-search{margin-top:10px}.hero-heading{margin-top:22px}.quick-actions{overflow:auto;padding-bottom:2px;margin-bottom:20px}.quick-actions button{white-space:nowrap}.food-row,.result-grid{grid-template-columns:1fr}.focus-section{margin-top:34px}.food-section{margin-top:35px}.search-summary{align-items:flex-start;gap:12px}.clear-search{padding:6px 8px}.result-row{display:block}.result-row>span{display:block;margin-top:8px}}
    `}</style>
  </main>;
}
