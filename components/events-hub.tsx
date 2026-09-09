'use client';

import { CalendarDays, ChevronRight, MapPin, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LocalEvent } from '../lib/discovery-data';

const filters = [
  ['all', 'Alles'],
  ['event', 'Evenementen'],
  ['activity', 'Activiteiten'],
  ['workshop', 'Workshops'],
] as const;

export default function EventsHub({ events }: { events: LocalEvent[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => events.filter((event) => {
    const matchesType = filter === 'all' || event.type === filter;
    const haystack = `${event.title} ${event.place} ${event.description}`.toLowerCase();
    return matchesType && haystack.includes(query.trim().toLowerCase());
  }).sort((a, b) => a.dateSort.localeCompare(b.dateSort)), [events, filter, query]);

  return <main className="discovery-page">
    <header className="discovery-header"><a href="/" className="discovery-brand"><span className="discovery-brand-mark"><img src="/icon.svg" alt="" /></span>Uithoorn<span>Online</span></a><nav><a href="/businesses">Bedrijven</a><a className="active" href="/events">Evenementen</a><a href="/deals">Aanbiedingen</a><a href="/signup">Delen</a></nav><a className="discovery-header-cta" href="/signup?kind=event">Evenement delen</a></header>

    <section className="discovery-hero discovery-hero-purple"><div><span className="uo-kicker">Lokale agenda</span><h1>Wat gebeurt er <em>dichtbij?</em></h1><p>Ontdek evenementen, activiteiten, lessen en initiatieven in Uithoorn en De Kwakel.</p><div className="discovery-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek een evenement, activiteit of workshop…" aria-label="Zoek in de agenda" /></div></div><div className="discovery-hero-art"><CalendarDays /></div></section>

    <section className="discovery-content"><div className="discovery-tabs" role="tablist" aria-label="Agenda filter">{filters.map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} role="tab" aria-selected={filter === value}>{label}</button>)}</div><div className="discovery-toolbar"><strong>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</strong><span>Uithoorn & De Kwakel</span></div>{filtered.length ? <div className="event-grid">{filtered.map((event) => { const past = event.dateSort < today && event.type !== 'activity'; return <article className={`event-card ${past ? 'past' : ''}`} key={event.slug}><div className="event-card-date"><span>{event.type === 'workshop' ? 'WORKSHOP' : event.type === 'activity' ? 'ACTIVITEIT' : 'AGENDA'}</span><strong>{event.dateLabel}</strong></div><div className="event-card-body"><span><MapPin /> {event.place}</span><h2>{event.title}</h2><p>{event.description}</p><a href={`/events/${event.slug}`}>Bekijk details <ChevronRight /></a></div></article>; })}</div> : <div className="discovery-empty"><Search /><h2>Geen resultaten</h2><p>Probeer een andere zoekterm of deel zelf een lokaal evenement.</p><a className="discovery-primary" href="/signup?kind=event">Evenement delen <ChevronRight /></a></div>}</section>
    <section className="discovery-bottom-cta"><div><span className="uo-kicker">Ken je iets lokaals?</span><h2>Help de agenda compleet te maken.</h2><p>Deel een evenement, activiteit, les of initiatief. We controleren de informatie voordat deze wordt gepubliceerd.</p></div><a className="discovery-primary" href="/signup?kind=event">Evenement delen <ChevronRight /></a></section>
  </main>;
}
