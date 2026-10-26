import type { Metadata } from 'next';
import { ArrowRight, BriefcaseBusiness, MessageCircle } from 'lucide-react';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { alternatesFor, isLocale, lp, whatsappHref, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

type Props = { params: Promise<{ lang: string }> };

async function langOf(params: Props['params']): Promise<Locale> {
  const { lang } = await params;
  return isLocale(lang) ? lang : 'nl';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await langOf(params);
  const t = getDictionary(lang).jobs;
  return { title: t.metaTitle, description: t.metaDescription, alternates: alternatesFor(lang, '/jobs') };
}

// The old page listed three example vacancies ("Voorbeeldvacature"). Until real vacancies exist, show an honest empty state.
export default async function JobsPage({ params }: Props) {
  const lang = await langOf(params);
  const t = getDictionary(lang).jobs;
  return <div className="ds-page">
    <SiteHeader />
    <main id="main" className="ds-simple">
      <section className="ds-container ds-simple-hero">
        <p className="ds-kicker">{t.kicker}</p>
        <h1>{t.title}</h1>
        <p className="ds-lead">{t.intro}</p>
      </section>
      <section className="ds-container">
        <div className="ds-empty-card">
          <BriefcaseBusiness aria-hidden="true" />
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyText}</p>
          <div className="ds-button-row">
            <a className="btn btn-primary" href={whatsappHref(t.whatsappMessage)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> {t.cta}</a>
            <a className="btn btn-secondary" href={lp(lang, '/businesses')}>{t.browse} <ArrowRight aria-hidden="true" /></a>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
