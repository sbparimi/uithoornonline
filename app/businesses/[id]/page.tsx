import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, BadgeCheck, Globe, MapPin, Phone, Star } from 'lucide-react';
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
  const { data: reviews } = await supabase.from('reviews').select('rating,body,created_at').eq('business_id', id).order('created_at', { ascending: false }).limit(10);
  const reviewCount = reviews?.length ?? 0;
  const average = reviewCount ? (reviews!.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1) : null;

  return <main className="uo-site uo-directory">
    <header className="uo-header"><div className="uo-header-inner"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><nav className="uo-nav"><a className="active" href="/businesses">Aanbieders</a><a href="/events">Agenda</a><a href="/food">Indian food</a></nav><div className="uo-header-actions"><span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span><a className="uo-header-cta" href="/request">Vraag lokale hulp</a></div></div></header>
    <section className="uo-provider-profile">
      <a className="platform-secondary-link" href="/businesses"><ArrowLeft /> Alle aanbieders</a>
      <div className="uo-provider-profile-head">
        <div><span className="uo-kicker">{business.category}</span><h1>{business.name}</h1><p className="uo-provider-profile-intro">{business.description || 'Lokale aanbieder in Uithoorn en De Kwakel.'}</p>{business.verified && <div className="uo-provider-trust"><BadgeCheck /> Geverifieerde lokale aanbieder</div>}{average && <div className="provider-profile-rating"><Star size={18} fill="currentColor" /><strong>{average}</strong><span>uit {reviewCount} geverifieerde {reviewCount === 1 ? 'beoordeling' : 'beoordelingen'}</span></div>}</div>
        <aside className="uo-provider-profile-card"><h2>Contact</h2>{(business.address || business.postcode) && <div className="uo-provider-detail"><MapPin /><span>{business.address || business.postcode}<br />Uithoorn & De Kwakel</span></div>}{business.phone && <div className="uo-provider-detail"><Phone /><a href={`tel:${business.phone}`}>{business.phone}</a></div>}{business.website && <div className="uo-provider-detail"><Globe /><a href={business.website} target="_blank" rel="noreferrer">Website</a></div>}<div className="uo-provider-profile-actions"><a className="primary" href="/request">Vraag lokale hulp <ArrowRight /></a>{business.phone && <a className="secondary" href={`tel:${business.phone}`}><Phone /> Bel aanbieder</a>}</div><p className="uo-provider-note">Beoordelingen kunnen alleen worden geplaatst na een afgerond gesprek via Uithoorn.online.</p></aside>
      </div>
      <section className="provider-profile-reviews" aria-labelledby="reviews-title"><div className="provider-profile-section-head"><div><span className="uo-kicker">Vertrouwen</span><h2 id="reviews-title">Ervaringen van klanten</h2></div>{average && <span className="provider-profile-rating"><Star size={16} fill="currentColor" /> {average} · {reviewCount}</span>}</div>{reviewCount ? <div className="provider-review-list">{reviews!.map((review) => <article className="provider-review" key={review.created_at}><div className="provider-review-stars" aria-label={`${review.rating} van 5 sterren`}>{[1,2,3,4,5].map((star) => <Star key={star} size={15} fill={star <= review.rating ? 'currentColor' : 'none'} />)}</div>{review.body && <p>{review.body}</p>}<small>{new Date(review.created_at).toLocaleDateString('nl-NL')}</small></article>)}</div> : <div className="provider-review-empty">Nog geen klantbeoordelingen. De eerste beoordeling volgt na een afgeronde opdracht.</div>}</section>
    </section>
    <footer className="uo-footer"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer>
  </main>;
}
