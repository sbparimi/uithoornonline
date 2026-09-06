'use client';

import { ArrowRight, BadgeCheck, Globe, MapPin, Phone, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

type ProviderItem = { id: string | null; title: string; meta: string; description: string; postcode: string; website: string | null; phone: string | null; verified: boolean };

function profileHref(item: ProviderItem) {
  return item.id ? `/businesses/${item.id}` : `/signup?role=provider&business=${encodeURIComponent(item.title)}`;
}

export function ProviderDirectory({ items }: { items: ProviderItem[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => items.filter((item) => `${item.title} ${item.meta} ${item.description} ${item.postcode}`.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);

  return <main className="uo-directory">
    <header className="uo-header"><div className="uo-header-inner"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><nav className="uo-nav"><a href="/services">Diensten</a><a href="/workshops">Workshops</a><a href="/#food">Indian food</a></nav><div className="uo-header-actions"><span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span><a className="uo-header-cta" href="/signup?role=provider">Word aanbieder</a></div></div></header>
    <section className="uo-directory-hero"><div><span className="uo-kicker">Lokale aanbieders</span><h1>Vind iemand dichtbij.</h1><p>Ontdek lokale professionals voor praktische hulp, onderhoud en diensten in Uithoorn en De Kwakel.</p><div className="uo-directory-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek lokaal..." aria-label="Zoek lokale aanbieders" /></div></div></section>
    <section className="uo-directory-results">
      <div className="uo-section-head"><div><span className="uo-kicker">Uithoorn & De Kwakel</span><h2>{filtered.length} {filtered.length === 1 ? 'aanbieder' : 'aanbieders'}</h2></div><a href="/signup?role=provider">Word zichtbaar <ArrowRight /></a></div>
      {items.length === 0 ? <div className="uo-empty"><MapPin /><h3>Nog geen geverifieerde aanbieders</h3><p>De lokale gids groeit. Meld je bedrijf aan om als eerste zichtbaar te worden.</p><a href="/signup?role=provider">Bedrijf aanmelden <ArrowRight /></a></div> : <div className="uo-directory-list">{filtered.map((item) => <article key={item.id ?? item.title}><div className="uo-directory-mark">{item.title.slice(0, 1)}</div><div className="uo-directory-copy"><span>{item.meta} · {item.postcode}{item.verified && <span className="uo-verified"><BadgeCheck /> Geverifieerd</span>}</span><h3>{item.title}</h3><p>{item.description}</p><div className="uo-provider-actions"><a href={profileHref(item)}>Bekijk profiel <ArrowRight /></a>{item.phone && <a href={`tel:${item.phone}`} aria-label={`Bel ${item.title}`}><Phone /></a>}{item.website && <a href={item.website} target="_blank" rel="noreferrer" aria-label={`Website ${item.title}`}><Globe /></a>}</div></div></article>)}</div>}
      {items.length > 0 && filtered.length === 0 && <div className="uo-empty"><Search /><h3>Geen resultaten</h3><p>Probeer een andere zoekterm.</p></div>}
    </section>
    <footer className="uo-footer"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer>
  </main>;
}
