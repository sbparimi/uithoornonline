import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, ShieldCheck, Zap } from 'lucide-react';
import '../../urgent.css';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import UrgentIntake from '../../../components/urgent-intake';
import { getCurrentUser } from '../../../lib/auth/session';
import { isLocale, seo, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';
import { REQUEST_CATEGORIES } from '../../../lib/request-options';
import { intakeEnabled, quotesEnabled, whatsappContactNumber } from '../../../lib/urgent/flags';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ lang: string }> };
const copy = {
  nl: { title: 'Hulp nodig? Direct een lokale vakman – Uithoorn.online', desc: 'Beschrijf je probleem, wij waarschuwen direct lokale vakmensen in Uithoorn en De Kwakel. Ook bij spoed, 24/7.', eyebrow: 'Hulp nodig?', h1a: 'Vertel wat er is,', h1b: 'wij regelen een vakman.', intro: 'Onze assistent stelt een paar korte vragen en waarschuwt meteen de vakmensen die erbij passen. De eerste die de klus aanneemt, neemt contact met je op.', trust: [['Direct', 'Vakmensen krijgen je vraag meteen'], ['Ook bij spoed', 'Na 10 minuten zonder reactie bellen we 24/7 spoedbedrijven'], ['Gratis', 'Geen kosten voor inwoners']] },
  en: { title: 'Need help? A local professional right away – Uithoorn.online', desc: 'Describe your problem and we alert local professionals in Uithoorn and De Kwakel right away. Emergencies too, 24/7.', eyebrow: 'Need help?', h1a: 'Tell us what’s wrong,', h1b: 'we’ll find a professional.', intro: 'Our assistant asks a few short questions and immediately alerts the professionals who fit. The first to accept the job will contact you.', trust: [['Instant', 'Professionals get your request right away'], ['Emergencies too', 'No response in 10 minutes? We call 24/7 emergency businesses'], ['Free', 'No cost for residents']] },
};

// AI request flow for all jobs (QUOTE_FLOW_ENABLED, docs/AI_REQUESTS.md): same page, wording for quotes too.
const quoteCopy = {
  nl: { title: 'Hulp of offerte aanvragen – Uithoorn.online', desc: 'Beschrijf je klus. Onze AI-assistent stelt een paar slimme vragen en stuurt je vraag naar de 3 best passende lokale bedrijven in Uithoorn en De Kwakel. Vergelijk hun offertes en kies zelf.', eyebrow: 'Hulp of offerte nodig?', h1a: 'Vertel wat je nodig hebt,', h1b: 'wij vinden de beste vakmensen.', intro: 'De assistent stelt een paar slimme vragen en stuurt je vraag naar de 3 best passende lokale bedrijven. Je vergelijkt hun offertes naast elkaar en kiest zelf. Bij spoed waarschuwen we meteen vakmensen die direct kunnen komen.', trust: [['Slimme vragen', 'De AI vraagt wat een bedrijf nodig heeft voor een goede offerte'], ['3 offertes', 'Vergelijk prijs, datum en beoordelingen naast elkaar'], ['Gratis', 'Geen kosten voor inwoners, je gegevens pas na jouw keuze']] },
  en: { title: 'Request help or a quote – Uithoorn.online', desc: 'Describe your job. Our AI assistant asks a few smart questions and sends your request to the 3 best-matching local businesses in Uithoorn and De Kwakel. Compare their quotes and choose.', eyebrow: 'Need help or a quote?', h1a: 'Tell us what you need,', h1b: 'we’ll find the best professionals.', intro: 'The assistant asks a few smart questions and sends your request to the 3 best-matching local businesses. You compare their quotes side by side and choose. For emergencies we alert professionals who can come right away.', trust: [['Smart questions', 'The AI asks what a business needs for a good quote'], ['3 quotes', 'Compare price, date and reviews side by side'], ['Free', 'No cost for residents, your details only after you choose']] },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const c = (quotesEnabled() ? quoteCopy : copy)[lang === 'en' ? 'en' : 'nl'];
  return { title: c.title, description: c.desc, ...seo(lang, '/hulp', c.title, c.desc) };
}

export default async function HulpPage({ params }: Props) {
  if (!intakeEnabled()) notFound();
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const quotes = quotesEnabled();
  const c = (quotes ? quoteCopy : copy)[lang === 'en' ? 'en' : 'nl'];
  const labels = getDictionary(lang).requestForm.categories as Record<string, string>;
  const categories: [string, string][] = REQUEST_CATEGORIES.map((v) => [v, labels[v] ?? v]);
  const user = await getCurrentUser();
  const icons = [Zap, Clock, ShieldCheck];
  return (
    <div className="ds-page">
      <SiteHeader active="request" />
      <main id="main" className="uo-easy-home ui-page">
        <section className="ui-hero">
          <div className="ui-intro">
            <p className="ds-eyebrow"><span aria-hidden="true" />{c.eyebrow}</p>
            <h1>{c.h1a} <em>{c.h1b}</em></h1>
            <p>{c.intro}</p>
            <ul className="ui-trust">{c.trust.map(([title, text], i) => { const Icon = icons[i]; return <li key={title}><Icon aria-hidden="true" /><div><strong>{title}</strong><small>{text}</small></div></li>; })}</ul>
          </div>
          <div className="ui-card">
            <UrgentIntake user={user && user.role !== 'provider' ? { name: user.fullName, email: user.email, phone: user.phone } : null} categories={categories} whatsapp={whatsappContactNumber()} quotes={quotes} />
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
