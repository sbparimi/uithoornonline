import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, ChevronRight, HeartHandshake, MapPin, MessageCircle, Search, Sparkles } from 'lucide-react';
import { SiteHeader } from '../../components/site-header';
import { SiteFooter } from '../../components/site-footer';
import { alternatesFor, isLocale, lp, SITE_URL, whatsappHref, type Locale } from '../../lib/i18n/config';
import { getDictionary } from '../../lib/i18n/dictionaries';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  return { title: { absolute: t.meta.homeTitle }, description: t.meta.homeDescription, alternates: alternatesFor(lang, '/') };
}

const trustIcons = [MapPin, BadgeCheck, HeartHandshake];

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const h = t.home;
  const search = (q: string) => lp(lang, `/businesses?search=${encodeURIComponent(q)}`);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Uithoorn.online',
    url: lang === 'nl' ? SITE_URL : `${SITE_URL}/en`,
    inLanguage: lang === 'nl' ? 'nl-NL' : 'en',
    description: t.meta.homeDescription,
    potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}${lp(lang, '/businesses')}?search={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };

  return (
    <div className="ds-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteHeader />
      <main id="main">
        <section className="home-hero">
          <div className="ds-container home-hero-inner">
            <p className="ds-eyebrow"><span aria-hidden="true" />{h.eyebrow}</p>
            <h1>{h.h1a} <em>{h.h1b}</em></h1>
            <p className="home-hero-intro">{h.intro}</p>
            <form className="home-search" action={lp(lang, '/businesses')} method="get" role="search">
              <Search aria-hidden="true" />
              <input name="search" type="search" placeholder={h.searchPlaceholder} aria-label={h.searchLabel} autoComplete="off" enterKeyHint="search" />
              <button type="submit" className="btn btn-primary">{h.searchButton}</button>
            </form>
            <div className="home-quick">
              <span>{h.popular}</span>
              {h.quick.map(([label, q]) => <a key={label} href={search(q)}>{label}</a>)}
            </div>
            <p className="home-describe">{h.orDescribe} <a href={lp(lang, '/request')}>{h.orDescribeLink} <ArrowRight aria-hidden="true" /></a></p>
          </div>
        </section>

        <section className="home-trust" aria-label={h.actionsLabel}>
          <div className="ds-container home-trust-grid">
            {h.trust.map(([title, text], i) => { const Icon = trustIcons[i]; return <div key={title} className="home-trust-item"><Icon aria-hidden="true" /><div><strong>{title}</strong><span>{text}</span></div></div>; })}
          </div>
        </section>

        <section className="ds-section" aria-label={h.actionsLabel}>
          <div className="ds-container home-actions">
            <a href={lp(lang, '/businesses')} className="home-action">
              <span className="home-action-icon"><Search aria-hidden="true" /></span>
              <span className="home-action-copy"><span className="ds-kicker">{h.findKicker}</span><strong>{h.findTitle}</strong><span>{h.findText}</span></span>
              <ArrowRight className="home-action-arrow" aria-hidden="true" />
            </a>
            <a href={lp(lang, '/request')} className="home-action home-action-accent">
              <span className="home-action-icon"><Sparkles aria-hidden="true" /></span>
              <span className="home-action-copy"><span className="ds-kicker">{h.helpKicker}</span><strong>{h.helpTitle}</strong><span>{h.helpText}</span></span>
              <ArrowRight className="home-action-arrow" aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="ds-section ds-section-tint" id="diensten">
          <div className="ds-container">
            <div className="ds-section-head">
              <div><p className="ds-kicker">{h.servicesKicker}</p><h2>{h.servicesTitle}</h2></div>
              <a className="ds-link" href={lp(lang, '/businesses')}>{h.servicesAll} <ChevronRight aria-hidden="true" /></a>
            </div>
            <div className="home-services">
              {h.services.map(([title, text, q]) => <a key={title} href={search(q)} className="home-service"><span><strong>{title}</strong><small>{text}</small></span><ChevronRight aria-hidden="true" /></a>)}
            </div>
          </div>
        </section>

        <section className="ds-section">
          <div className="ds-container home-how">
            <div><p className="ds-kicker">{h.howKicker}</p><h2>{h.howTitle}</h2></div>
            <ol className="home-steps">
              {h.steps.map(([title, text], i) => <li key={title}><span className="home-step-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><strong>{title}</strong><span>{text}</span></li>)}
            </ol>
          </div>
        </section>

        <section className="ds-section">
          <div className="ds-container">
            <div className="home-biz">
              <div>
                <p className="ds-kicker">{h.bizKicker}</p>
                <h2>{h.bizTitle}</h2>
                <p>{h.bizText}</p>
              </div>
              <div className="home-biz-actions">
                <a className="btn btn-light" href={lp(lang, '/voor-bedrijven')}>{h.bizCta} <ArrowRight aria-hidden="true" /></a>
                <a className="btn btn-ghost-light" href={lp(lang, '/signup/account?role=provider')}>{h.bizSecondary}</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
      <a className="floating-help" href={whatsappHref(h.whatsappMessage)} target="_blank" rel="noopener noreferrer" aria-label={h.whatsappAria}><MessageCircle aria-hidden="true" /><span>{h.whatsappLabel}</span></a>
    </div>
  );
}
