import type { Metadata } from 'next';
import { Check, MapPin } from 'lucide-react';
import RequestForm from './RequestForm';

export const metadata: Metadata = { title: 'Plaats je bedrijf — Uithoorn.online', description: 'Word zichtbaar voor mensen die lokaal zoeken in Uithoorn en De Kwakel.' };

export default function RequestPage() {
  return <main className="uo-directory"><header className="uo-header"><div className="uo-header-inner"><a href="/" className="uo-brand"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><nav className="uo-nav"><a href="/services">Diensten</a><a href="/workshops">Workshops</a><a href="/food">Indian food</a></nav><div className="uo-header-actions"><span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span><a href="/businesses">Aanbieders</a></div></div></header><section className="request-page"><div className="request-layout"><div><span className="uo-kicker">Voor lokale ondernemers</span><h1 className="directory-title">Sta waar je<br /><em>gevonden wordt.</em></h1><p className="directory-intro">Vertel wat je aanbiedt. Uithoorn.online helpt lokale klanten je sneller te vinden.</p><div className="request-benefits"><div><Check /> Eén duidelijke bedrijfsaanvraag</div><div><Check /> Gericht op Uithoorn & De Kwakel</div><div><Check /> Diensten, workshops en food</div></div></div><RequestForm /></div></section><footer className="uo-footer"><a href="/" className="uo-brand"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer></main>;
}
