import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, BadgeCheck, Globe, Mail, MapPin, Phone, Star } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getPublicBusiness, getPublicBusinessPhotos } from '../../../../lib/data/businesses';
import { SiteHeader } from '../../../../components/site-header';
import { SiteFooter } from '../../../../components/site-footer';
import { localizeBusiness, type PublicBusiness } from '../../../../lib/business-content';
import { seo, dateLocale, isLocale, lp, SITE_URL, type Locale } from '../../../../lib/i18n/config';
import { getDictionary } from '../../../../lib/i18n/dictionaries';
import { jsonLd } from '../../../../lib/json-ld';

type Props = { params: Promise<{ lang: string; id: string }> };
type Review = { rating: number; body: string | null; created_at: string };

async function loadBusiness(id: string): Promise<{ business: PublicBusiness | null; reviews: Review[] }> {
  // Only approved + active listings; hidden reviews are excluded server-side.
  const found = await getPublicBusiness(id);
  return { business: found?.business ?? null, reviews: found?.reviews ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw, id } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const { business } = await loadBusiness(id);
  if (!business) return { title: t.profile.metaFallback, robots: { index: false } };
  const b = localizeBusiness(business, lang);
  const title = `${b.name} · ${b.category}`;
  const description = b.description || t.profile.metaDescription(b.name);
  return { title, description, ...seo(lang, `/businesses/${id}`, title, description) };
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
  // Optional public contact email the business chose to show (never the owner's login email).
  const email = business.public_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.public_email) ? business.public_email : null;
  const photos = await getPublicBusinessPhotos(id);
  const pageUrl = `${SITE_URL}${lp(lang, `/businesses/${id}`)}`;
  // Structured data for search engines: only facts the listing itself carries.
  const jsonLdData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/businesses/${id}`,
    name: business.name,
    url: pageUrl,
    ...(business.description ? { description: business.description } : {}),
    ...(business.phone ? { telephone: tel } : {}),
    ...(email ? { email } : {}),
    ...(business.website && /^https?:\/\//i.test(business.website) ? { sameAs: [business.website] } : {}),
    ...((business.address || business.postcode) ? { address: { '@type': 'PostalAddress', ...(business.address ? { streetAddress: business.address } : {}), ...(business.postcode ? { postalCode: business.postcode } : {}), addressCountry: 'NL' } } : {}),
    ...(photos.length ? { image: photos.map((ph) => ph.url) } : {}),
    ...(average ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: average, reviewCount } } : {}),
  };

  return <div className="ds-page">
    <SiteHeader active="businesses" />
    <main id="main" className="uo-site uo-directory ds-directory">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jsonLdData) }} />
      <section className="uo-provider-profile">
        <a className="platform-secondary-link" href={lp(lang, '/businesses')}><ArrowLeft aria-hidden="true" /> {p.back}</a>
        <div className="uo-provider-profile-head">
          <div><span className="uo-kicker">{business.category}</span><h1>{business.name}</h1><p className="uo-provider-profile-intro">{business.description || t.common.localProviderDesc}</p>{business.verified && <div className="uo-provider-trust"><BadgeCheck aria-hidden="true" /> {p.verified}</div>}{average && <div className="provider-profile-rating"><Star size={18} fill="currentColor" aria-hidden="true" /><strong>{average}</strong><span>{p.ratingOf(reviewCount)}</span></div>}</div>
          <aside className="uo-provider-profile-card"><h2>{p.contact}</h2>{(business.address || business.postcode) && <div className="uo-provider-detail"><MapPin aria-hidden="true" /><span>{business.address || business.postcode}<br />{t.common.area}</span></div>}{business.phone && <div className="uo-provider-detail"><Phone aria-hidden="true" /><a href={`tel:${tel}`}>{business.phone}</a></div>}{business.website && /^https?:\/\//i.test(business.website) && <div className="uo-provider-detail"><Globe aria-hidden="true" /><a href={business.website} target="_blank" rel="noopener noreferrer">{business.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></div>}{email && <div className="uo-provider-detail"><Mail aria-hidden="true" /><a href={`mailto:${email}`}>{email}</a></div>}<div className="uo-provider-profile-actions"><a className="primary" href={lp(lang, '/request')}>{p.requestHelp} <ArrowRight aria-hidden="true" /></a>{business.phone && <a className="secondary" href={`tel:${tel}`}><Phone aria-hidden="true" /> {p.callProvider}</a>}</div><p className="uo-provider-note">{p.reviewNote}</p></aside>
        </div>
        {photos.length ? <div className="adm-public-photos" aria-label={lang === 'en' ? 'Photos' : 'Foto’s'}>{photos.map((ph, i) => <img key={i} src={ph.url} alt={ph.alt || business.name} loading="lazy" decoding="async" />)}</div> : null}
        <section className="provider-profile-reviews" aria-labelledby="reviews-title"><div className="provider-profile-section-head"><div><span className="uo-kicker">{p.trustKicker}</span><h2 id="reviews-title">{p.reviewsTitle}</h2></div>{average && <span className="provider-profile-rating"><Star size={16} fill="currentColor" aria-hidden="true" /> {average} · {reviewCount}</span>}</div>{reviewCount ? <div className="provider-review-list">{reviews.map((review) => <article className="provider-review" key={review.created_at}><div className="provider-review-stars" role="img" aria-label={p.stars(review.rating)}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} fill={star <= review.rating ? 'currentColor' : 'none'} aria-hidden="true" />)}</div>{review.body && <p>{review.body}</p>}<small>{new Date(review.created_at).toLocaleDateString(dateLocale(lang))} · <span className="provider-review-verified"><BadgeCheck size={13} aria-hidden="true" /> {lang === 'en' ? 'Verified job' : 'Geverifieerde klus'}</span></small></article>)}</div> : <div className="provider-review-empty">{p.noReviews}</div>}</section>
      </section>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
