import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, MapPin } from 'lucide-react';
import { notFound } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import { SiteHeader } from '../../../../components/site-header';
import { SiteFooter } from '../../../../components/site-footer';
import { fallbackBusinesses, localizeBusiness, type PublicBusiness } from '../../../../lib/business-content';
import { alternatesFor, isLocale, locales, lp, type Locale } from '../../../../lib/i18n/config';
import { getDictionary } from '../../../../lib/i18n/dictionaries';

const terms: Record<string, { key: string; terms: string[] }> = {
  'loodgieter-uithoorn': { key: 'plumber', terms: ['loodgiet', 'plumb', 'lekkage', 'water', 'verwarming', 'cv'] },
  'elektricien-uithoorn': { key: 'plumber', terms: ['elektr', 'electric', 'install'] },
  'tuinman-uithoorn': { key: 'garden', terms: ['tuin', 'garden', 'hovenier', 'landschap', 'bestrating'] },
  'schoonmaker-uithoorn': { key: 'cleaning', terms: ['schoon', 'clean', 'huishoud', 'ramen'] },
  'handyman-uithoorn': { key: 'home', terms: ['handyman', 'klus', 'reparatie', 'onderhoud', 'montage'] },
  'verhuizer-uithoorn': { key: 'transport', terms: ['verhuis', 'moving', 'transport', 'koerier'] },
};

type Props = { params: Promise<{ lang: string; slug: string }> };

export function generateStaticParams() {
  return locales.flatMap((lang) => Object.keys(terms).map((slug) => ({ lang, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw, slug } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const s = getDictionary(lang).service;
  const service = s.services[slug];
  if (!service) return { title: s.kicker };
  return { title: service[0], description: s.metaDescription(service[1]), alternates: alternatesFor(lang, `/diensten/${slug}`) };
}

export default async function ServiceLandingPage({ params }: Props) {
  const { lang: raw, slug } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const s = t.service;
  const service = s.services[slug];
  const config = terms[slug];
  if (!service || !config) notFound();
  let businesses: PublicBusiness[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('businesses').select('id,name,category,description,postcode,verified,website,phone').eq('active', true).eq('verified', true).or(config.terms.map((term) => `category.ilike.%${term}%,description.ilike.%${term}%`).join(',')).limit(20);
    businesses = (data as PublicBusiness[] | null) ?? [];
  } catch {
    businesses = [];
  }
  if (!businesses.length) {
    businesses = fallbackBusinesses.filter((b) => config.terms.some((term) => `${b.category} ${b.description}`.toLowerCase().includes(term)));
  }
  const requestHref = lp(lang, `/request?category=${config.key}`);
  return <div className="ds-page">
    <SiteHeader active="businesses" />
    <main id="main" className="uo-site uo-directory ds-directory">
      <section className="service-landing">
        <span className="uo-kicker">{s.kicker}</span>
        <h1>{service[0]}</h1>
        <p>{s.intro}</p>
        <div className="service-landing-actions"><a className="primary" href={requestHref}>{s.cta} <ArrowRight aria-hidden="true" /></a><a className="secondary" href={lp(lang, '/businesses')}>{s.all}</a></div>
        <div className="service-landing-results">
          <div className="provider-profile-section-head"><div><span className="uo-kicker">{s.availableKicker}</span><h2>{s.count(businesses.length)}</h2></div></div>
          {businesses.length ? <div className="directory-provider-cards">{businesses.map((raw) => { const business = localizeBusiness(raw, lang); return <article className="directory-provider-card" key={business.id}><div className="directory-provider-avatar" aria-hidden="true">{business.name.slice(0, 1)}</div><div className="directory-provider-copy"><div className="directory-provider-topline"><span>{business.category}</span>{business.verified && <span className="directory-provider-verified"><BadgeCheck aria-hidden="true" /> {t.common.verified}</span>}</div><h3>{business.name}</h3><p>{business.description || t.common.localProviderDesc}</p><div className="directory-provider-meta"><span><MapPin aria-hidden="true" /> {t.common.town} · {business.postcode || t.common.town}</span></div><a href={lp(lang, `/businesses/${business.id}`)}>{t.common.viewProfile} <ArrowRight aria-hidden="true" /></a></div></article>; })}</div> : <div className="uo-empty"><MapPin aria-hidden="true" /><h3>{s.emptyTitle}</h3><p>{s.emptyText}</p><a href={requestHref}>{s.emptyCta} <ArrowRight aria-hidden="true" /></a></div>}
        </div>
      </section>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
