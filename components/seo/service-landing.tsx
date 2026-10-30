import { ArrowRight, BadgeCheck, Check, ChevronDown, Globe, MapPin, Phone } from 'lucide-react';
import { SiteHeader } from '../site-header';
import { SiteFooter } from '../site-footer';
import { SectionIcon } from '../directory/icons';
import { lp, SITE_URL, type Locale } from '../../lib/i18n/config';
import { CATEGORY_BY_SLUG, SECTION_BY_ID } from '../../lib/directory/taxonomy';
import type { DirectoryCard } from '../../lib/directory/data';
import { SEO_SERVICES, SEO_TOWNS, type SeoService, type SeoTown } from '../../lib/seo/services';
import type { ServiceListings } from '../../lib/seo/listings';
import { seoText } from '../../lib/seo/text';

// Service × town landing page (/diensten/<service>/<plaats>) and the service hub (/diensten/<service>).
// Server component: everything is in the HTML for search engines; listings are the live directory.

function Card({ b, lang }: { b: DirectoryCard; lang: Locale }) {
  const t = seoText[lang];
  const section = SECTION_BY_ID.get(b.section);
  const href = lp(lang, `/businesses/${b.id}`);
  const where = [b.town || t.nearbyTown, b.postcode].filter(Boolean).join(' · ');
  return (
    <article className="dir2-card" data-section={b.section}>
      <a className="dir2-card-main" href={href}>
        <span className="dir2-card-icon" aria-hidden="true">{section ? <SectionIcon name={section.icon} /> : b.name.slice(0, 1)}</span>
        <span className="dir2-card-body">
          <span className="dir2-card-cat">{b.category}</span>
          <span className="dir2-card-name">{b.name}{b.verified && <BadgeCheck className="dir2-verified" aria-label={t.verified} />}</span>
          {b.line && <span className="dir2-card-line">{b.line}</span>}
          <span className="dir2-card-where"><MapPin aria-hidden="true" /> {where}</span>
        </span>
      </a>
      <div className="dir2-card-actions">
        {b.phone && <a className="dir2-btn dir2-btn-sm" href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}><Phone aria-hidden="true" /> {t.call}</a>}
        {b.website && <a className="dir2-btn dir2-btn-sm" href={b.website} target="_blank" rel="noopener noreferrer"><Globe aria-hidden="true" /> {t.website}</a>}
        <a className="dir2-btn dir2-btn-sm dir2-btn-ghost" href={href}>{t.view} <ArrowRight aria-hidden="true" /></a>
      </div>
    </article>
  );
}

export function serviceJsonLd(lang: Locale, service: SeoService, town: SeoTown | null, listings: ServiceListings) {
  const t = seoText[lang];
  const c = service[lang];
  const path = town ? `/diensten/${service.slug}/${town.slug}` : `/diensten/${service.slug}`;
  const url = `${SITE_URL}${lp(lang, path)}`;
  const area = town ? [town.name] : SEO_TOWNS.map((x) => x.name);
  const faq = [...c.faq, ...t.genericFaq(c.term, town?.name ?? 'Uithoorn')];
  const all = [...listings.local, ...listings.nearby];
  const crumbs = [
    { name: t.home, item: `${SITE_URL}${lp(lang, '/')}` },
    { name: t.services, item: `${SITE_URL}${lp(lang, '/diensten')}` },
    { name: c.title, item: `${SITE_URL}${lp(lang, `/diensten/${service.slug}`)}` },
    ...(town ? [{ name: town.name, item: url }] : []),
  ];
  return [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.item })) },
    {
      '@context': 'https://schema.org', '@type': 'Service', name: t.h1(c.title, town?.name ?? null), serviceType: c.title, url,
      areaServed: area.map((name) => ({ '@type': 'City', name })),
      provider: { '@type': 'Organization', name: 'Uithoorn.online', url: SITE_URL },
      ...(all.length ? { hasOfferCatalog: { '@type': 'OfferCatalog', name: c.title, itemListElement: all.slice(0, 20).map((b) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: c.title }, offeredBy: {
        '@type': 'LocalBusiness', name: b.name, url: `${SITE_URL}${lp(lang, `/businesses/${b.id}`)}`,
        ...(b.phone ? { telephone: b.phone } : {}),
        ...(b.postcode || b.town ? { address: { '@type': 'PostalAddress', ...(b.postcode ? { postalCode: b.postcode } : {}), ...(b.town ? { addressLocality: b.town } : {}), addressCountry: 'NL' } } : {}),
      } })) } } : {}),
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
}

export function ServiceLanding({ lang, service, town, listings, requestHref }: { lang: Locale; service: SeoService; town: SeoTown | null; listings: ServiceListings; requestHref: string }) {
  const t = seoText[lang];
  const c = service[lang];
  const townName = town?.name ?? null;
  const placeName = townName ?? 'Uithoorn';
  const cat = CATEGORY_BY_SLUG.get(service.category);
  const section = cat ? SECTION_BY_ID.get(cat.section) : undefined;
  const signupHref = lp(lang, '/signup/account?role=provider');
  const faq = [...c.faq, ...t.genericFaq(c.term, placeName)];
  const related = SEO_SERVICES.filter((s) => s.slug !== service.slug && CATEGORY_BY_SLUG.get(s.category)?.section === cat?.section).slice(0, 6);
  const empty = listings.total === 0;
  return (
    <div className="ds-page dir2-page">
      <SiteHeader active="businesses" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd(lang, service, town, listings)).replace(/</g, '\\u003c') }} />
      <main id="main" className="dir2 seo-svc">
        <section className="dir2-hero seo-svc-hero">
          <div className="dir2-wrap">
            <nav className="dir2-crumbs" aria-label="Breadcrumb">
              <a href={lp(lang, '/')}>{t.home}</a><span aria-hidden="true">/</span>
              <a href={lp(lang, '/diensten')}>{t.services}</a><span aria-hidden="true">/</span>
              {town ? <><a href={lp(lang, `/diensten/${service.slug}`)}>{c.title}</a><span aria-hidden="true">/</span><span aria-current="page">{town.name}</span></> : <span aria-current="page">{c.title}</span>}
            </nav>
            <div className="seo-svc-head">
              {section && <span className="seo-svc-icon" aria-hidden="true"><SectionIcon name={section.icon} /></span>}
              <h1>{t.h1(c.title, townName)}<span>{t.h1Sub}</span></h1>
            </div>
            <p className="dir2-sub seo-svc-intro">{c.intro}</p>
            <div className="seo-svc-cta">
              <a className="dir2-btn dir2-btn-primary dir2-btn-wide" href={requestHref}>{t.cta} <ArrowRight aria-hidden="true" /></a>
              <span className="seo-svc-cta-note">{t.ctaNote}</span>
            </div>
            <nav className="seo-svc-towns" aria-label={t.otherTowns(c.title)}>
              {SEO_TOWNS.map((x) => <a key={x.slug} href={lp(lang, `/diensten/${service.slug}/${x.slug}`)} className={x.slug === town?.slug ? 'is-active' : ''} aria-current={x.slug === town?.slug ? 'page' : undefined}><MapPin aria-hidden="true" /> {x.name}</a>)}
            </nav>
          </div>
        </section>

        <div className="dir2-wrap seo-svc-body">
          <section className="seo-svc-section" aria-labelledby="svc-list">
            {empty ? (
              <div className="dir2-empty dir2-invite">
                <span className="dir2-kicker">{t.inviteKicker}</span>
                <h2 id="svc-list">{t.inviteTitle}</h2>
                <p>{t.inviteText(c.term, placeName)}</p>
                <div className="dir2-empty-actions"><a className="dir2-btn dir2-btn-primary" href={signupHref}>{t.inviteCta} <ArrowRight aria-hidden="true" /></a></div>
                <p className="dir2-invite-customer">{t.inviteCustomer} <a href={requestHref}>{t.cta} <ArrowRight aria-hidden="true" /></a></p>
                <p className="seo-svc-muted">{t.inviteCustomerText}</p>
              </div>
            ) : (
              <>
                <div className="seo-svc-listhead">
                  <h2 id="svc-list">{townName ? t.listedIn(c.title, townName) : t.listedArea(c.title)}</h2>
                  <span className="dir2-tile-count">{t.count(listings.total)}</span>
                </div>
                {town && listings.local.length === 0 && <p className="seo-svc-muted">{t.noneLocal(c.term, town.name)}</p>}
                {listings.local.length > 0 && <ul className="dir2-cards">{listings.local.map((b) => <li key={b.id}><Card b={b} lang={lang} /></li>)}</ul>}
                {listings.nearby.length > 0 && <>
                  {listings.local.length > 0 && <h3 className="seo-svc-subhead">{t.nearby(town?.name ?? 'Uithoorn')}</h3>}
                  <ul className="dir2-cards">{listings.nearby.map((b) => <li key={b.id}><Card b={b} lang={lang} /></li>)}</ul>
                </>}
                {cat && <p className="seo-svc-more"><a href={lp(lang, `/businesses/categorie/${cat.slug}`)}>{t.all(c.title)} <ArrowRight aria-hidden="true" /></a></p>}
              </>
            )}
          </section>

          <div className="seo-svc-grid">
            <section className="seo-svc-panel">
              <h2>{t.jobsTitle(c.term)}</h2>
              <ul className="seo-svc-list">{c.jobs.map((j) => <li key={j}><Check aria-hidden="true" /> {j}</li>)}</ul>
            </section>
            <section className="seo-svc-panel">
              <h2>{t.tipsTitle(c.term)}</h2>
              <ol className="seo-svc-tips">{c.tips.map((j) => <li key={j}>{j}</li>)}</ol>
            </section>
          </div>

          {town && <section className="seo-svc-panel seo-svc-town">
            <h2>{t.townTitle(c.term, town.name)}</h2>
            <p>{town[lang]}</p>
            <a className="dir2-btn dir2-btn-primary" href={requestHref}>{t.cta} <ArrowRight aria-hidden="true" /></a>
          </section>}

          <section className="seo-svc-panel">
            <h2>{t.howTitle}</h2>
            <ol className="seo-svc-steps">{t.how.map(([h, p], i) => <li key={h}><span className="seo-svc-step-n" aria-hidden="true">{i + 1}</span><div><strong>{h}</strong><p>{p}</p></div></li>)}</ol>
          </section>

          <section className="seo-svc-panel">
            <h2>{t.faqTitle}</h2>
            <div className="seo-svc-faq">{faq.map(([q, a]) => <details key={q}><summary>{q}<ChevronDown aria-hidden="true" /></summary><p>{a}</p></details>)}</div>
          </section>

          <section className="seo-svc-links">
            {related.length > 0 && <div><h2>{t.related}</h2><ul>{related.map((s) => <li key={s.slug}><a href={lp(lang, `/diensten/${s.slug}${town ? `/${town.slug}` : ''}`)}>{t.h1(s[lang].title, townName)}</a></li>)}</ul></div>}
            <div><h2>{t.otherTowns(c.title)}</h2><ul>{SEO_TOWNS.filter((x) => x.slug !== town?.slug).map((x) => <li key={x.slug}><a href={lp(lang, `/diensten/${service.slug}/${x.slug}`)}>{t.h1(c.title, x.name)}</a></li>)}</ul></div>
          </section>

          <section className="seo-svc-biz">
            <div><h2>{t.bizTitle(c.term, placeName)}</h2><p>{t.bizText}</p></div>
            <a className="dir2-btn" href={signupHref}>{t.bizCta} <ArrowRight aria-hidden="true" /></a>
          </section>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
