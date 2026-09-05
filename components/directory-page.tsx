'use client';

import { ArrowRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

type Item = { title: string; meta: string; description: string; label?: string };

export function DirectoryPage({ title, eyebrow, intro, items, cta }: { title: string; eyebrow: string; intro: string; items: Item[]; cta?: string }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => items.filter((item) => `${item.title} ${item.meta} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  return <main>
    <header className="nav-wrap"><nav className="nav shell"><a className="brand" href="/"><span className="brand-mark">U</span><span>uithoorn<span>.online</span></span></a><div className="desktop-nav"><a href="/businesses">Ontdek</a><a href="/services">Diensten</a><a href="/events">Agenda</a><a href="/for-businesses">Voor bedrijven</a></div><a className="nav-cta desktop-only" href="/for-businesses">Plaats je bedrijf</a></nav></header>
    <section className="directory-hero"><div className="shell"><span className="kicker">{eyebrow}</span><h1 className="directory-title">{title}</h1><p className="directory-intro">{intro}</p><div className="directory-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek binnen deze categorie…" aria-label={`Zoek in ${title}`} /></div></div></section>
    <section className="section"><div className="shell"><div className="directory-toolbar"><span>{filtered.length} resultaten</span>{cta && <a className="primary" href="/request">{cta}<ArrowRight /></a>}</div><div className="directory-grid">{filtered.map((item) => <article className="directory-card" key={item.title}><div className="directory-card-top"><span>{item.label ?? 'Lokaal'}</span><span>{item.meta}</span></div><h2>{item.title}</h2><p>{item.description}</p><a href="/request" className="text-link">Meer informatie <ArrowRight /></a></article>)}</div>{filtered.length === 0 && <div className="empty">Geen resultaten gevonden. Probeer een andere zoekterm.</div>}</div></section>
    <footer><div className="shell copyright">© 2026 Uithoorn.online · Uithoorn & De Kwakel</div></footer>
  </main>;
}
