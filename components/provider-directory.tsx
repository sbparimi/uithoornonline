'use client';

import { ArrowRight, BadgeCheck, Globe, MapPin, Phone, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';

type ProviderItem = { id: string | null; title: string; meta: string; description: string; postcode: string; website: string | null; phone: string | null; verified: boolean };

const demandFilters = [
  ['all', 'Alles'],
  ['SpiceIndia', 'SpiceIndia'],
  ['garden', 'Tuin & buiten'],
  ['home improvement', 'Huis & klus'],
  ['plumber', 'Loodgieter'],
  ['handyman', 'Handyman'],
] as const;

function profileHref(item: ProviderItem) {
  return item.id ? `/businesses/${item.id}` : `/signup?role=provider&business=${encodeURIComponent(item.title)}`;
}

export function ProviderDirectory({ items, initialQuery = '', showDemandFilters = false }: { items: ProviderItem[]; initialQuery?: string; showDemandFilters?: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const activeFilter = demandFilters.find(([value]) => value === filter)?.[1] ?? 'Alles';

  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.title} ${item.meta} ${item.description} ${item.postcode}`.toLowerCase();
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || haystack.includes(q);
    if (filter === 'all') return matchesQuery;
    if (filter === 'SpiceIndia') return matchesQuery && item.title.toLowerCase().includes('spiceindia');
    if (filter === 'garden') return matchesQuery && /garden|tuin|landscap|outdoor|hoveni/.test(haystack);
    if (filter === 'home improvement') return matchesQuery && /renov|paving|tiling|fenc|klus|onderhoud|bouw/.test(haystack);
    if (filter === 'plumber') return matchesQuery && /plumb|loodgiet|install/.test(haystack);
    if (filter === 'handyman') return matchesQuery && /handyman|klus|multiservice/.test(haystack);
    return matchesQuery;
  }), [items, query, filter]);

  const requestHref = filter === 'all' ? '/request' : `/request?category=${encodeURIComponent(activeFilter)}`;

  return <main className="uo-directory">
    <header className="uo-header"><div className="uo-header-inner"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><nav className="uo-nav"><a href="/businesses">Ontdek</a><a href="/events">Agenda</a><a href="/deals">Aanbiedingen</a><a href="/food">Indian food</a></nav><div className="uo-header-actions"><span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span><a className="uo-header-cta" href="/signup?role=provider">Bedrijf toevoegen</a></div></div></header>
    <section className="uo-directory-hero"><div><span className="uo-kicker">Een plek in Uithoorn</span><h1>Vind wat je zoekt.</h1><p>Ontdek lokale bedrijven, professionals en voorzieningen in Uithoorn en De Kwakel. Zoek op naam, dienst of buurt.</p><div className="uo-directory-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek restaurant, winkel, loodgieter, tuin…" aria-label="Zoek in Uithoorn" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Wis zoekopdracht"><X /></button>}</div></div></section>
    <section className="uo-directory-results">
      {showDemandFilters && <div className="directory-demand"><div className="directory-demand-head"><div><span className="uo-kicker">Populaire lokale zoekopdrachten</span><h2>Waar zijn mensen naar op zoek?</h2></div><button type="button" onClick={() => setShowFilters((value) => !value)}><SlidersHorizontal /> Filters</button></div><div className={`directory-filter-list ${showFilters ? 'open' : ''}`}>{demandFilters.map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} type="button" onClick={() => setFilter(value)}>{label}</button>)}</div></div>}
      <div className="uo-section-head"><div><span className="uo-kicker">Uithoorn & De Kwakel</span><h2>{filtered.length} {filtered.length === 1 ? 'resultaat' : 'resultaten'}</h2></div><a href={requestHref}>Niet gevonden? Vraag lokale hulp <ArrowRight /></a></div>
      {items.length === 0 ? <div className="uo-empty"><MapPin /><h3>Nog geen geverifieerde aanbieders</h3><p>De lokale gids groeit. Meld je bedrijf aan om als eerste zichtbaar te worden.</p><a href="/signup?role=provider">Bedrijf aanmelden <ArrowRight /></a></div> : <div className="uo-directory-list">{filtered.map((item) => <article key={item.id ?? item.title}><div className="uo-directory-mark">{item.title.slice(0, 1)}</div><div className="uo-directory-copy"><span>{item.meta} · {item.postcode}{item.verified && <span className="uo-verified"><BadgeCheck /> Geverifieerd</span>}</span><h3>{item.title}</h3><p>{item.description}</p><div className="uo-provider-actions"><a href={profileHref(item)}>Bekijk profiel <ArrowRight /></a>{item.phone && <a href={`tel:${item.phone}`} aria-label={`Bel ${item.title}`}><Phone /></a>}{item.website && <a href={item.website} target="_blank" rel="noreferrer" aria-label={`Website ${item.title}`}><Globe /></a>}</div></div></article>)}</div>}
      {items.length > 0 && filtered.length === 0 && <div className="uo-empty"><Search /><h3>Geen geverifieerde resultaten voor “{query || activeFilter}”</h3><p>Je kunt een lokale hulpvraag plaatsen. We zoeken dan bij passende geverifieerde aanbieders.</p><a href={requestHref}>Vraag lokale hulp <ArrowRight /></a></div>}
    </section>
    <footer className="uo-footer"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer>
  </main>;
}
