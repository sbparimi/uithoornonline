'use client';

import { ArrowRight, Search } from 'lucide-react';
import { lp } from '../../lib/i18n/config';
import { useDict, useLang } from '../../components/lang-context';
import { SiteHeader } from '../../components/site-header';
import { SiteFooter } from '../../components/site-footer';

export default function NotFound() {
  const lang = useLang();
  const t = useDict().notFound;
  return <div className="ds-page">
    <title>{`${t.metaTitle} — Uithoorn.online`}</title>
    <meta name="robots" content="noindex" />
    <SiteHeader />
    <main id="main" className="ds-simple">
      <section className="ds-container ds-simple-hero ds-center">
        <p className="ds-kicker">{t.kicker}</p>
        <h1>{t.title}</h1>
        <p className="ds-lead">{t.text}</p>
        <div className="ds-button-row ds-center-row">
          <a className="btn btn-primary" href={lp(lang, '/businesses')}><Search aria-hidden="true" /> {t.businesses}</a>
          <a className="btn btn-secondary" href={lp(lang, '/')}>{t.home} <ArrowRight aria-hidden="true" /></a>
        </div>
      </section>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
