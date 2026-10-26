import type { Metadata } from 'next';
import { ArrowLeft, Check, MessageCircle, Sparkles } from 'lucide-react';
import RequestForm from './RequestForm';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { alternatesFor, isLocale, lp, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ category?: string; query?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang).request;
  return { title: t.metaTitle, description: t.metaDescription, alternates: alternatesFor(lang, '/request') };
}

export default async function RequestPage({ params, searchParams }: Props) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang).request;

  return (
    <div className="ds-page">
      <SiteHeader active="request" />
      <main id="main" className="uo-easy-home uo-request-page ds-request">
        <section className="request-hero">
          <div className="request-hero-inner">
            <div className="request-intro">
              <p className="ds-eyebrow"><span aria-hidden="true" />{t.eyebrow}</p>
              <h1>{t.h1a} <em>{t.h1b}</em></h1>
              <p>{t.intro}</p>
              <div className="request-trust">
                {t.trust.map(([title, text]) => <div key={title}><span><Check aria-hidden="true" /></span><div><strong>{title}</strong><small>{text}</small></div></div>)}
              </div>
              <a className="request-back-link" href={lp(lang, '/businesses')}><ArrowLeft aria-hidden="true" /> {t.back}</a>
            </div>
            <div className="request-form-shell">
              <div className="request-form-head">
                <div className="request-form-icon"><Sparkles aria-hidden="true" /></div>
                <div>
                  <span className="easy-label">{t.formKicker}</span>
                  <h2>{t.formTitle}</h2>
                </div>
              </div>
              <p className="request-form-note"><MessageCircle aria-hidden="true" /> {t.formNote}</p>
              <RequestForm initialCategory={sp.category ?? ''} initialQuery={sp.query ?? ''} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
