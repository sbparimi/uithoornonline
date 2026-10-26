import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, BadgeCheck, Globe, MapPin, Phone, Star } from 'lucide-react';
import { notFound } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import { SiteHeader } from '../../../../components/site-header';
import { SiteFooter } from '../../../../components/site-footer';
import { fallbackBusinesses, localizeBusiness, type PublicBusiness } from '../../../../lib/business-content';
import { alternatesFor, dateLocale, isLocale, lp, type Locale } from '../../../../lib/i18n/config';
import { getDictionary } from '../../../../lib/i18n/dictionaries';

type Props = { params: Promise<{ lang: string; id: string }> };
type Review = { rating: number; body: string | null; created_at: string };

async function loadBusiness(id: string): Promise<{ business: PublicBusiness | null; reviews: Review[] }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('businesses').select('id,name,category,description,postcode,address,website,phone,verified').eq('id', id).eq('active', true).eq('verified', true).maybeSingle();
    if (data) {
      const { data: reviews } = await supabase.from('reviews').select('rating,body,created_at').eq('business_id', id).order('created_at', { ascending: false }).limit(10);
      return { business: data as PublicBusiness, reviews: (reviews as Review[] | null) ?? [] };
    }
  } catch {
    // fall through to the built-in listings
  }
  return { business: fallbackBusinesses.find((b) => b.id === id) ?? null, reviews: [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw, id } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const { business } = await loadBusiness(id);
  if (!business) return { title: t.profile.metaFallback, robots: { index: false } };
  const b = localizeBusiness(business, lang);
  return { title: `${b.name} · ${b.category}`, description: b.description || t.profile.metaDescription(b.name), alternates: alternatesFor(lang, `/businesses/${id}`) };
}

export default async function BusinessProfilePage({ params }: Props) {
  const { lang: raw, id } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const p = t.profile;
  const { business: rawBusiness, reviews } = await loadBusiness(id);
  if (!rawBusiness) notFound();
  const business = localizeBusiness(rawBusiness, lang);
  const reviewCount = reviews.length;
  const average = reviewCount ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1) : null;
  const tel = business.phone?.replace(/\s/g, '');

  return <div className="ds-page">
    <SiteHeader active="businesses" />
    <main id="main" className="uo-site uo-directory ds-directory">
      <section className="uo-provider-profile">
        <a className="platform-secondary-link" href={lp(lang, '/businesses')}><ArrowLeft aria-hidden="true" /> {p.back}</a>
        <div className="uo-provider-profile-head">
          <div><span className="uo-kicker">{business.category}</span><h1>{business.name}</h1><p className="uo-provider-profile-intro">{business.description || t.common.localProviderDesc}</p>{business.verified && <div className="uo-provider-trust"><BadgeCheck aria-hidden="true" /> {p.verified}</div>}{average && <div className="provider-profile-rating"><Star size={18} fill="currentColor" aria-hidden="true" /><strong>{average}</strong><span>{p.ratingOf(reviewCount)}</span></div>}</div>
          <aside className="uo-provider-profile-card"><h2>{p.contact}</h2>{(business.address || business.postcode) && <div className="uo-provider-detail"><MapPin aria-hidden="true" /><span>{business.address || business.postcode}<br />{t.common.area}</span></div>}{business.phone && <div className="uo-provider-detail"><Phone aria-hidden="true" /><a href={`tel:${tel}`}>{business.phone}</a></div>}{business.website && <div className="uo-provider-detail"><Globe aria-hidden="true" /><a href={business.website} target="_blank" rel="noopener noreferrer">{business.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></div>}<div className="uo-provider-profile-actions"><a className="primary" href={lp(lang, '/request')}>{p.requestHelp} <ArrowRight aria-hidden="true" /></a>{business.phone && <a className="secondary" href={`tel:${tel}`}><Phone aria-hidden="true" /> {p.callProvider}</a>}</div><p className="uo-provider-note">{p.reviewNote}</p></aside>
        </div>
        <section className="provider-profile-reviews" aria-labelledby="reviews-title"><div className="provider-profile-section-head"><div><span className="uo-kicker">{p.trustKicker}</span><h2 id="reviews-title">{p.reviewsTitle}</h2></div>{average && <span className="provider-profile-rating"><Star size={16} fill="currentColor" aria-hidden="true" /> {average} · {reviewCount}</span>}</div>{reviewCount ? <div className="provider-review-list">{reviews.map((review) => <article className="provider-review" key={review.created_at}><div className="provider-review-stars" role="img" aria-label={p.stars(review.rating)}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} fill={star <= review.rating ? 'currentColor' : 'none'} aria-hidden="true" />)}</div>{review.body && <p>{review.body}</p>}<small>{new Date(review.created_at).toLocaleDateString(dateLocale(lang))}</small></article>)}</div> : <div className="provider-review-empty">{p.noReviews}</div>}</section>
      </section>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
