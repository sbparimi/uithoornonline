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
import { getPublicExtras } from '../../../../lib/ai-business/profile';
import { DAYS, DAY_LABELS, amsterdamNow, formatDay, hasAnyHours, isOpenNow } from '../../../../lib/hours';
import { BusinessChat } from '../../../../components/ai-business/business-chat';
import { ClickTracker } from '../../../../components/ai-business/click-tracker';
import '../../../ai-business.css';

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
  const extras = await getPublicExtras(id);
  const localized = localizeBusiness(rawBusiness, lang);
  // English page: the business's own English text when it has one (AI profile builder, owner-reviewed).
  const business = lang === 'en' && extras?.description_en ? { ...localized, description: extras.description_en } : localized;
  const hours = extras?.opening_hours ?? null;
  const openNow = isOpenNow(hours);
  const today = amsterdamNow().day;
  const services = (extras?.services ?? []).map((s) => (lang === 'en' ? s.en || s.nl : s.nl || s.en)).filter(Boolean);
  const faqs = (extras?.faqs ?? []).map((f) => ({ q: lang === 'en' ? f.q_en || f.q_nl : f.q_nl || f.q_en, a: lang === 'en' ? f.a_en || f.a_nl : f.a_nl || f.a_en })).filter((f) => f.q && f.a);
  const chatOn = extras ? extras.chat_enabled : true;
  const chatSuggestions = lang === 'en'
    ? [hasAnyHours(hours) ? 'Are you open today?' : null, services[0] ? `Do you offer ${services[0].toLowerCase()}?` : 'What do you offer?', 'Can I get a quote?'].filter(Boolean) as string[]
    : [hasAnyHours(hours) ? 'Zijn jullie vandaag open?' : null, services[0] ? `Doen jullie ${services[0].toLowerCase()}?` : 'Wat bieden jullie aan?', 'Kan ik een offerte krijgen?'].filter(Boolean) as string[];
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
    ...(hasAnyHours(hours) ? { openingHoursSpecification: DAYS.flatMap((d) => (hours![d] ?? []).map(([opens, closes]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${DAY_LABELS.en[d]}`, opens, closes }))) } : {}),
    ...(average ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: average, reviewCount } } : {}),
  };

  return <div className="ds-page">
    <SiteHeader active="businesses" />
    <main id="main" className="uo-site uo-directory ds-directory">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jsonLdData) }} />
      <section className="uo-provider-profile" data-biz-page={id}>
        <a className="platform-secondary-link" href={lp(lang, '/businesses')}><ArrowLeft aria-hidden="true" /> {p.back}</a>
        <div className="uo-provider-profile-head">
          <div><span className="uo-kicker">{business.category}</span><h1>{business.name}</h1><p className="uo-provider-profile-intro">{business.description || t.common.localProviderDesc}</p>{business.verified && <div className="uo-provider-trust"><BadgeCheck aria-hidden="true" /> {p.verified}</div>}{openNow !== null && <div className={`aib-open-pill ${openNow ? 'is-open' : 'is-closed'}`}>{openNow ? (lang === 'en' ? 'Open now' : 'Nu open') : (lang === 'en' ? 'Closed now' : 'Nu gesloten')} · {lang === 'en' ? 'today' : 'vandaag'} {formatDay(hours?.[today], lang)}</div>}{average && <div className="provider-profile-rating"><Star size={18} fill="currentColor" aria-hidden="true" /><strong>{average}</strong><span>{p.ratingOf(reviewCount)}</span></div>}</div>
          <aside className="uo-provider-profile-card"><h2>{p.contact}</h2>{(business.address || business.postcode) && <div className="uo-provider-detail"><MapPin aria-hidden="true" /><span>{business.address || business.postcode}<br />{t.common.area}</span></div>}{business.phone && <div className="uo-provider-detail"><Phone aria-hidden="true" /><a href={`tel:${tel}`}>{business.phone}</a></div>}{business.website && /^https?:\/\//i.test(business.website) && <div className="uo-provider-detail"><Globe aria-hidden="true" /><a href={business.website} target="_blank" rel="noopener noreferrer" data-track-website="">{business.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></div>}{email && <div className="uo-provider-detail"><Mail aria-hidden="true" /><a href={`mailto:${email}`}>{email}</a></div>}<div className="uo-provider-profile-actions"><a className="primary" href={lp(lang, '/request')}>{p.requestHelp} <ArrowRight aria-hidden="true" /></a>{business.phone && <a className="secondary" href={`tel:${tel}`}><Phone aria-hidden="true" /> {p.callProvider}</a>}{chatOn && <a className="secondary aib-ask-link" href="#vraag">{lang === 'en' ? 'Ask a question' : 'Stel een vraag'}</a>}</div><p className="uo-provider-note">{p.reviewNote}</p></aside>
        </div>
        {photos.length ? <div className="adm-public-photos" aria-label={lang === 'en' ? 'Photos' : 'Foto’s'}>{photos.map((ph, i) => <img key={i} src={ph.url} alt={ph.alt || business.name} loading="lazy" decoding="async" />)}</div> : null}
        {(services.length > 0 || hasAnyHours(hours) || hours?.note) && <div className="aib-extras">
          {services.length > 0 && <section className="aib-card" aria-labelledby="aib-services"><h2 id="aib-services">{lang === 'en' ? 'Services' : 'Diensten'}</h2><ul className="aib-services">{services.map((s) => <li key={s}>{s}</li>)}</ul></section>}
          {(hasAnyHours(hours) || hours?.note) && <section className="aib-card" aria-labelledby="aib-hours"><h2 id="aib-hours">{lang === 'en' ? 'Opening hours' : 'Openingstijden'}</h2>{hasAnyHours(hours) && <table className="aib-hours"><tbody>{DAYS.map((d) => <tr key={d} className={d === today ? 'is-today' : ''}><th scope="row">{DAY_LABELS[lang][d]}</th><td>{formatDay(hours?.[d], lang)}</td></tr>)}</tbody></table>}{hours?.note && <p className="aib-note">{hours.note}</p>}</section>}
        </div>}
        {faqs.length > 0 && <section className="aib-card aib-faq" aria-labelledby="aib-faq"><h2 id="aib-faq">{lang === 'en' ? 'Frequently asked questions' : 'Veelgestelde vragen'}</h2>{faqs.map((f, i) => <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}</section>}
        {chatOn && <BusinessChat businessId={id} businessName={business.name} lang={lang} suggestions={chatSuggestions} />}
        <section className="provider-profile-reviews" aria-labelledby="reviews-title"><div className="provider-profile-section-head"><div><span className="uo-kicker">{p.trustKicker}</span><h2 id="reviews-title">{p.reviewsTitle}</h2></div>{average && <span className="provider-profile-rating"><Star size={16} fill="currentColor" aria-hidden="true" /> {average} · {reviewCount}</span>}</div>{reviewCount ? <div className="provider-review-list">{reviews.map((review) => <article className="provider-review" key={review.created_at}><div className="provider-review-stars" role="img" aria-label={p.stars(review.rating)}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} fill={star <= review.rating ? 'currentColor' : 'none'} aria-hidden="true" />)}</div>{review.body && <p>{review.body}</p>}<small>{new Date(review.created_at).toLocaleDateString(dateLocale(lang))}</small></article>)}</div> : <div className="provider-review-empty">{p.noReviews}</div>}</section>
      </section>
    </main>
    <SiteFooter lang={lang} />
    <ClickTracker viewBusinessId={id} />
  </div>;
}
