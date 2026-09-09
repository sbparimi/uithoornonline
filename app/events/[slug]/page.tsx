import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getEvent } from '../../../lib/discovery-data';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = getEvent(slug);
  return event ? { title: `${event.title} — Uithoorn.online`, description: event.description } : { title: 'Evenement — Uithoorn.online' };
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();
  return <main className="discovery-page"><header className="discovery-header"><a href="/" className="discovery-brand"><span className="discovery-brand-mark"><img src="/icon.svg" alt="" /></span>Uithoorn<span>Online</span></a><nav><a href="/businesses">Bedrijven</a><a className="active" href="/events">Evenementen</a><a href="/deals">Aanbiedingen</a><a href="/signup">Delen</a></nav><a className="discovery-header-cta" href="/signup?kind=event">Evenement delen</a></header><section className="event-detail"><a className="discovery-back" href="/events"><ArrowLeft /> Terug naar agenda</a><div className="event-detail-layout"><div><span className="uo-kicker">{event.type === 'workshop' ? 'Workshop' : event.type === 'activity' ? 'Activiteit' : 'Lokaal evenement'}</span><h1>{event.title}</h1><p>{event.description}</p><div className="event-detail-meta"><span><CalendarDays /> {event.dateLabel}</span><span><MapPin /> {event.place}</span></div></div><aside className="event-detail-card"><CalendarDays /><h2>Plan je bezoek</h2><p>Gebruik de datum en locatie hierboven om je bezoek te plannen. Voor aanvullende informatie kun je de organisator of locatie rechtstreeks raadplegen.</p><a className="discovery-primary" href="/signup?kind=event">Informatie aanvullen <ArrowRight /></a></aside></div></section><section className="discovery-bottom-cta compact"><div><span className="uo-kicker">Organiseer je dit?</span><h2>Help de buurt met actuele informatie.</h2><p>Stuur een correctie of deel een nieuw lokaal evenement.</p></div><a className="discovery-primary" href="/signup?kind=event">Evenement delen <ArrowRight /></a></section></main>;
}
