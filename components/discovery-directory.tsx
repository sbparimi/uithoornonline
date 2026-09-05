'use client';

import { ArrowRight, MapPin, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

type Item = { title: string; meta: string; description: string; label?: string };

export function DiscoveryDirectory({ title, eyebrow, intro, items, cta = 'Plaats je bedrijf' }: { title: string; eyebrow: string; intro: string; items: Item[]; cta?: string }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => items.filter((item) => `${item.title} ${item.meta} ${item.description} ${item.label ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);
  return <main className="uo-directory"><header className="uo-header"><div className="uo-header-inner"><a href="/" className="uo-brand"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><nav className="uo-nav"><a href="/services">Diensten</a><a href="/workshops">Workshops</a><a href="/#food">Indian food</a></nav><div className="uo-header-actions"><span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span><a href="/businesses">Aanbieders</a><a className="uo-header-cta" href="/request">Plaats je bedrijf</a></div></div></header>
    <section className="uo-directory-hero"><div><span className="uo-kicker">{eyebrow}</span><h1>{title}</h1><p>{intro}</p><div className="uo-directory-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek lokaal..." aria-label={`Zoek in ${title}`} />{query && <button onClick={() => setQuery('')} aria-label="Wissen"><X /></button>}</div></div></section>
    <section className="uo-directory-results"><div className="uo-section-head"><div><span className="uo-kicker">Uithoorn & De Kwakel</span><h2>{filtered.length} {filtered.length === 1 ? 'resultaat' : 'resultaten'}</h2></div><a href="/request">{cta} <ArrowRight /></a></div><div className="uo-directory-list">{filtered.map((item) => <article key={item.title}><div className="uo-directory-mark">{item.title.slice(0,1)}</div><div className="uo-directory-copy"><span>{item.label ?? 'Lokaal'} · {item.meta}</span><h3>{item.title}</h3><p>{item.description}</p><a href="/request">Meer informatie <ArrowRight /></a></div></article>)}</div>{filtered.length === 0 && <div className="uo-empty"><Search /><h3>Geen resultaten</h3><p>Probeer een andere zoekterm.</p></div>}</section><footer className="uo-footer"><a href="/" className="uo-brand"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer></main>;
}
