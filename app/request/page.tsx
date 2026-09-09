import type { Metadata } from 'next';
import { Check, MapPin } from 'lucide-react';
import RequestForm from './RequestForm';

export const metadata: Metadata = { title: 'Vraag lokale hulp — Uithoorn.online', description: 'Plaats een aanvraag en kom in contact met lokale aanbieders in Uithoorn en De Kwakel.' };

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const params = await searchParams;
  return <main className="uo-site uo-directory"><header className="uo-header"><div className="uo-header-inner"><a href="/" className="uo-brand" aria-label="Uithoorn.online home"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><nav className="uo-nav" aria-label="Hoofdnavigatie"><a href="/businesses">Bedrijven</a><a href="/events">Agenda</a><a href="/food">Indian food</a></nav><div className="uo-header-actions"><span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span><a className="uo-header-cta" href="/signup">Deel iets lokaals</a></div></div></header><section className="request-page"><div className="request-layout"><div className="request-copy"><span className="uo-kicker">Lokale hulp</span><h1 className="directory-title">Vertel wat je<br /><em>nodig hebt.</em></h1><p className="directory-intro">Plaats je aanvraag en kom in contact met lokale aanbieders in Uithoorn en De Kwakel.</p><div className="request-benefits"><div><Check /> Je aanvraag wordt veilig opgeslagen</div><div><Check /> Alleen gedeeld met passende aanbieders</div><div><Check /> Communicatie blijft op Uithoorn.online</div></div></div><RequestForm initialCategory={params.category ?? ''} /></div></section><footer className="uo-footer"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer></main>;
}
