import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, BadgeCheck, Globe, MapPin, Phone } from 'lucide-react';
import { notFound } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: business } = await supabase.from('businesses').select('name,category,description').eq('id', id).eq('active', true).eq('verified', true).maybeSingle();
  return business ? { title: `${business.name} — Uithoorn.online`, description: business.description || `${business.name} is a verified local provider in Uithoorn and De Kwakel.` } : { title: 'Lokale aanbieder — Uithoorn.online' };
}

export default async function BusinessProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: business } = await supabase.from('businesses').select('id,name,category,description,postcode,address,website,phone,verified').eq('id', id).eq('active', true).eq('verified', true).maybeSingle();
  if (!business) notFound();

  return <main className="uo-site uo-directory">
    <header className="uo-header"><div className="uo-header-inner"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><nav className="uo-nav"><a href="/businesses">Aanbieders</a><a href="/services">Diensten</a><a href="/workshops">Workshops</a></nav><div className="uo-header-actions"><span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span><a className="uo-header-cta" href="/request">Vraag lokale hulp</a></div></div></header>
    <section className="uo-provider-profile">
      <a className="platform-secondary-link" href="/businesses"><ArrowLeft /> Alle aanbieders</a>
      <div className="uo-provider-profile-head">
        <div><span className="uo-kicker">{business.category}</span><h1>{business.name}</h1><p className="uo-provider-profile-intro">{business.description || 'Lokale aanbieder in Uithoorn en De Kwakel.'}</p>{business.verified && <div className="uo-provider-trust"><BadgeCheck /> Geverifieerde lokale aanbieder</div>}</div>
        <aside className="uo-provider-profile-card"><h2>Contact</h2>{(business.address || business.postcode) && <div className="uo-provider-detail"><MapPin /><span>{business.address || business.postcode}<br />Uithoorn & De Kwakel</span></div>}{business.phone && <div className="uo-provider-detail"><Phone /><a href={`tel:${business.phone}`}>{business.phone}</a></div>}{business.website && <div className="uo-provider-detail"><Globe /><a href={business.website} target="_blank" rel="noreferrer">Website</a></div>}<div className="uo-provider-profile-actions"><a className="primary" href="/request">Vraag lokale hulp <ArrowRight /></a>{business.phone && <a className="secondary" href={`tel:${business.phone}`}><Phone /> Bel aanbieder</a>}</div><p className="uo-provider-note">Uithoorn.online toont alleen informatie die door een lokale aanbieder is aangeleverd en door het platform is geverifieerd.</p></aside>
      </div>
    </section>
    <footer className="uo-footer"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer>
  </main>;
}
