'use client';

import { ArrowRight, Search, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';

type Deal = { slug: string; title: string; label: string; description: string };

export default function DealsHub({ deals }: { deals: Deal[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => deals.filter((deal) => `${deal.title} ${deal.label} ${deal.description}`.toLowerCase().includes(query.trim().toLowerCase())), [deals, query]);

  return <main className="discovery-page"><header className="discovery-header"><a href="/" className="discovery-brand"><span className="discovery-brand-mark"><img src="/icon.svg" alt="" /></span>Uithoorn<span>Online</span></a><nav><a href="/businesses">Bedrijven</a><a className="active" href="/deals">Aanbiedingen</a><a href="/signup">Delen</a></nav><a className="discovery-header-cta" href="/signup?kind=business">Aanbieding plaatsen</a></header>
    <section className="discovery-hero discovery-hero-orange"><div><span className="uo-kicker">Lokaal voordeel</span><h1>Meer voordeel <em>om de hoek.</em></h1><p>Ontdek kortingen, speciale aanbiedingen, nieuwe producten en seizoensdeals van lokale bedrijven.</p><div className="discovery-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek een aanbieding of bedrijf…" aria-label="Zoek aanbiedingen" /></div></div><div className="discovery-hero-art orange"><Tag /></div></section>
    <section className="discovery-content"><div className="discovery-toolbar"><strong>{filtered.length} {filtered.length === 1 ? 'aanbieding' : 'aanbiedingen'}</strong><span>Uithoorn & De Kwakel</span></div>{filtered.length ? <div className="deal-grid">{filtered.map((deal) => <article className="deal-card" key={deal.slug}><span>{deal.label}</span><h2>{deal.title}</h2><p>{deal.description}</p><a href={`/deals/${deal.slug}`}>Bekijk aanbieding <ArrowRight /></a></article>)}</div> : <div className="discovery-empty"><Tag /><h2>Nog geen actieve aanbiedingen</h2><p>Zodra lokale ondernemers een aanbieding publiceren, verschijnt deze hier. Je kunt ook direct lokale bedrijven ontdekken.</p><div className="discovery-empty-actions"><a className="discovery-primary" href="/businesses">Ontdek bedrijven <ArrowRight /></a><a className="discovery-secondary" href="/signup?kind=business">Plaats een aanbieding <ArrowRight /></a></div></div>}</section>
    <section className="discovery-bottom-cta"><div><span className="uo-kicker">Voor lokale ondernemers</span><h2>Maak je aanbod zichtbaar.</h2><p>Deel je bedrijf met Uithoorn en gebruik Uithoorn.online om lokaal gevonden te worden.</p></div><a className="discovery-primary" href="/signup?kind=business">Bedrijf toevoegen <ArrowRight /></a></section>
  </main>;
}
