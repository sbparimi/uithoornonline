import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { seo, formatDutchMobile, isLocale, lp, WHATSAPP_NUMBER, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

type Props = { params: Promise<{ lang: string }> };
type Section = { h: string; p?: string[]; ul?: string[] };

const content: Record<Locale, { title: string; description: string; intro: string; sections: Section[] }> = {
  nl: {
    title: 'Cookiebeleid',
    description: 'Welke cookies Uithoorn.online gebruikt.',
    intro: 'Uithoorn.online gebruikt alleen functionele cookies en vergelijkbare technieken die nodig zijn om de website te laten werken. We plaatsen geen advertentie- of trackingcookies en gebruiken geen analysediensten van derden. Voor functionele cookies is volgens de Telecommunicatiewet geen toestemming nodig.',
    sections: [
      { h: 'Welke cookies plaatsen we?', ul: [
        'uithoorn-locale: onthoudt of je de website in het Nederlands of Engels wilt zien. Bewaartermijn: 1 jaar.',
        'sb-…-auth-token: houdt je ingelogd nadat je een inloglink hebt gebruikt. Alleen als je inlogt. Vervalt bij uitloggen of na de sessieduur.',
      ] },
      { h: 'Opslag in je browser', ul: [
        'uithoorn-request-draft (sessionStorage): bewaart tijdelijk je hulpvraag als je eerst moet inloggen, zodat je niets opnieuw hoeft te typen. Wordt gewist zodra je aanvraag is verstuurd of je het tabblad sluit.',
        'spiceindia-exit-ad-dismissed (sessionStorage): onthoudt dat je de tip over SpiceIndia hebt gesloten, zodat je die niet opnieuw ziet. Wordt gewist als je het tabblad sluit.',
      ] },
      { h: 'Statistieken', p: ['Om aanbieders inzicht te geven in weergaven en contactmomenten registreren we anonieme gebeurtenissen op onze eigen server. Hiervoor plaatsen we geen cookies van derden.'] },
      { h: 'Cookies verwijderen', p: ['Je kunt cookies altijd verwijderen via de instellingen van je browser. De website blijft dan werken, maar je moet opnieuw inloggen en je taalkeuze opnieuw maken.'] },
      { h: 'Vragen', p: [`Vragen over cookies of privacy? Stuur ons een WhatsApp-bericht op ${formatDutchMobile(WHATSAPP_NUMBER)}.`] },
    ],
  },
  en: {
    title: 'Cookie policy',
    description: 'Which cookies Uithoorn.online uses.',
    intro: 'Uithoorn.online only uses functional cookies and similar techniques needed to make the website work. We do not place advertising or tracking cookies and do not use third-party analytics services. Under Dutch law (Telecommunicatiewet), functional cookies do not require consent.',
    sections: [
      { h: 'Which cookies do we set?', ul: [
        'uithoorn-locale: remembers whether you want to see the website in Dutch or English. Kept for 1 year.',
        'sb-…-auth-token: keeps you signed in after you have used a sign-in link. Only when you sign in. Expires when you sign out or at the end of the session.',
      ] },
      { h: 'Storage in your browser', ul: [
        'uithoorn-request-draft (sessionStorage): temporarily keeps your help request if you need to sign in first, so you don’t have to type it again. Cleared once your request is sent or when you close the tab.',
        'spiceindia-exit-ad-dismissed (sessionStorage): remembers that you closed the SpiceIndia tip so you don’t see it again. Cleared when you close the tab.',
      ] },
      { h: 'Statistics', p: ['To give providers insight into views and contacts, we record anonymous events on our own server. No third-party cookies are used for this.'] },
      { h: 'Deleting cookies', p: ['You can delete cookies at any time in your browser settings. The website keeps working, but you will need to sign in and choose your language again.'] },
      { h: 'Questions', p: [`Questions about cookies or privacy? Send us a WhatsApp message on ${formatDutchMobile(WHATSAPP_NUMBER)}.`] },
    ],
  },
};

const PATH = '/cookies';
const OTHER: string = '/privacy';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return { title: content[lang].title, description: content[lang].description, ...seo(lang, PATH, content[lang].title, content[lang].description) };
}

export default async function LegalPage({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const c = content[lang];
  return <div className="ds-page">
    <SiteHeader />
    <main id="main" className="ds-simple">
      <article className="ds-container legal">
        <p className="ds-kicker">Uithoorn.online</p>
        <h1>{c.title}</h1>
        <div className="legal-draft" role="note"><AlertTriangle aria-hidden="true" /><div><strong>{t.legal.draftTitle}</strong><p>{t.legal.draftText}</p></div></div>
        <p className="ds-lead">{c.intro}</p>
        {c.sections.map((s) => <section key={s.h}><h2>{s.h}</h2>{s.p?.map((para) => <p key={para}>{para}</p>)}{s.ul && <ul>{s.ul.map((li) => <li key={li}>{li}</li>)}</ul>}</section>)}
        <p className="legal-updated">{t.legal.updated} · <a href={lp(lang, OTHER)}>{OTHER === '/cookies' ? t.footer.cookies : t.footer.privacy}</a></p>
      </article>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
