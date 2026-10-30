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
import { intakeEnabled } from '../../../lib/urgent/flags';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ lang: string }> };
const copy = {
  nl: { title: 'Hulp nodig? Direct een lokale vakman – Uithoorn.online', desc: 'Beschrijf je probleem, wij waarschuwen direct lokale vakmensen in Uithoorn en De Kwakel. Ook bij spoed, 24/7.', eyebrow: 'Hulp nodig?', h1a: 'Vertel wat er is,', h1b: 'wij regelen een vakman.', intro: 'Onze assistent stelt een paar korte vragen en waarschuwt meteen de vakmensen die erbij passen. De eerste die de klus aanneemt, neemt contact met je op.', trust: [['Direct', 'Vakmensen krijgen je vraag meteen'], ['Ook bij spoed', 'Na 10 minuten zonder reactie bellen we 24/7 spoedbedrijven'], ['Gratis', 'Geen kosten voor inwoners']] },
  en: { title: 'Need help? A local professional right away – Uithoorn.online', desc: 'Describe your problem and we alert local professionals in Uithoorn and De Kwakel right away. Emergencies too, 24/7.', eyebrow: 'Need help?', h1a: 'Tell us what’s wrong,', h1b: 'we’ll find a professional.', intro: 'Our assistant asks a few short questions and immediately alerts the professionals who fit. The first to accept the job will contact you.', trust: [['Instant', 'Professionals get your request right away'], ['Emergencies too', 'No response in 10 minutes? We call 24/7 emergency businesses'], ['Free', 'No cost for residents']] },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const c = copy[lang === 'en' ? 'en' : 'nl'];
  return { title: c.title, description: c.desc, ...seo(lang, '/hulp', c.title, c.desc) };
}

export default async function HulpPage({ params }: Props) {
  if (!intakeEnabled()) notFound();
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const c = copy[lang === 'en' ? 'en' : 'nl'];
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
            <UrgentIntake user={user && user.role !== 'provider' ? { name: user.fullName, email: user.email, phone: user.phone } : null} categories={categories} />
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
