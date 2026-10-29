'use client';

import { useEffect } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { lp } from '../../lib/i18n/config';
import { useLang } from '../../components/lang-context';
import { SiteHeader } from '../../components/site-header';
import { SiteFooter } from '../../components/site-footer';

const copy = {
  nl: { meta: 'Er ging iets mis', kicker: 'Foutje', title: 'Er ging iets mis.', text: 'Deze pagina kon even niet geladen worden. Probeer het opnieuw; lukt het niet, kom dan later terug of neem contact met ons op.', retry: 'Opnieuw proberen', home: 'Naar de homepage', ref: 'Foutcode' },
  en: { meta: 'Something went wrong', kicker: 'Oops', title: 'Something went wrong.', text: 'This page could not be loaded right now. Please try again; if it keeps happening, come back later or get in touch.', retry: 'Try again', home: 'Go to the homepage', ref: 'Error code' },
};

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = useLang();
  const t = copy[lang];
  useEffect(() => { console.error(error); }, [error]);
  return <div className="ds-page">
    <title>{`${t.meta} — Uithoorn.online`}</title>
    <meta name="robots" content="noindex" />
    <SiteHeader />
    <main id="main" className="ds-simple">
      <section className="ds-container ds-simple-hero ds-center" role="alert">
        <p className="ds-kicker">{t.kicker}</p>
        <h1>{t.title}</h1>
        <p className="ds-lead">{t.text}</p>
        <div className="ds-button-row ds-center-row">
          <button type="button" className="btn btn-primary" onClick={() => reset()}><RotateCcw aria-hidden="true" /> {t.retry}</button>
          <a className="btn btn-secondary" href={lp(lang, '/')}>{t.home} <ArrowRight aria-hidden="true" /></a>
        </div>
        {error.digest ? <p style={{ fontSize: 13, opacity: .7 }}>{t.ref}: {error.digest}</p> : null}
      </section>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
