import type { Metadata } from 'next';
import { MessageCircle } from 'lucide-react';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { ContactForm } from '../../../components/contact-form';
import { alternatesFor, formatDutchMobile, isLocale, lp, WHATSAPP_NUMBER, whatsappHref, type Locale } from '../../../lib/i18n/config';
import { getBackendDict } from '../../../lib/i18n/backend';
import { COMPANY } from '../../../lib/legal/content';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const c = getBackendDict(lang).contact;
  return { title: c.metaTitle, description: c.intro, alternates: alternatesFor(lang, '/contact') };
}

export default async function ContactPage({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const b = getBackendDict(lang);
  const c = b.contact;
  const mark = (text: string) => (text.startsWith('[') ? <mark className="legal-placeholder">{text}</mark> : text);
  return <div className="ds-page">
    <SiteHeader />
    <main id="main" className="platform-shell ds-platform">
      <div className="platform-card wide">
        <span className="uo-kicker">{c.kicker}</span>
        <h1>{c.title}</h1>
        <p>{c.intro}</p>
        <ContactForm />
      </div>
      <aside className="platform-card">
        <h2>{c.whatsappTitle}</h2>
        <p>{c.whatsappText}</p>
        <a className="primary platform-button-link" href={whatsappHref(c.whatsappMessage)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> {formatDutchMobile(WHATSAPP_NUMBER)}</a>
        <h2 style={{ marginTop: 24 }}>{c.companyTitle}</h2>
        <p><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
        <p>{COMPANY.tradeName}<br />{mark(COMPANY.legalName)}<br />{mark(COMPANY.address)}</p>
        {COMPANY.kvk && <p>KvK: {COMPANY.kvk}</p>}
        <p><a href={lp(lang, '/privacy')}>{lang === 'en' ? 'Privacy policy' : 'Privacyverklaring'}</a> · <a href={lp(lang, '/voorwaarden')}>{lang === 'en' ? 'Terms' : 'Algemene voorwaarden'}</a></p>
      </aside>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
