import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { alternatesFor, formatDutchMobile, isLocale, lp, WHATSAPP_NUMBER, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

type Props = { params: Promise<{ lang: string }> };
type Section = { h: string; p?: string[]; ul?: string[] };

const content: Record<Locale, { title: string; description: string; intro: string; sections: Section[] }> = {
  nl: {
    title: 'Privacyverklaring',
    description: 'Hoe Uithoorn.online omgaat met je persoonsgegevens.',
    intro: 'Uithoorn.online is een lokaal platform voor Uithoorn en De Kwakel. We gaan zorgvuldig om met je gegevens en verwerken alleen wat nodig is om de website te laten werken. In deze verklaring lees je welke gegevens dat zijn, waarom we ze gebruiken en welke rechten je hebt onder de Algemene verordening gegevensbescherming (AVG).',
    sections: [
      { h: 'Wie is verantwoordelijk?', p: ['Uithoorn.online, gevestigd in Uithoorn. [Naam van de onderneming of eigenaar, adres en KvK-nummer invullen.]', `Contact: via WhatsApp op ${formatDutchMobile(WHATSAPP_NUMBER)} of per e-mail op [e-mailadres invullen].`] },
      { h: 'Welke gegevens verwerken we?', ul: [
        'Accountgegevens: naam, e-mailadres, telefoonnummer (optioneel) en of je klant of aanbieder bent.',
        'Bedrijfsgegevens van aanbieders: bedrijfsnaam, categorie, beschrijving, postcode, adres, website en telefoonnummer.',
        'Hulpvragen: categorie, omschrijving van de klus, postcode, gewenste planning, budget en urgentie.',
        'Berichten tussen bewoners en aanbieders, en beoordelingen na een afgeronde opdracht.',
        'Bijdragen die je via de website instuurt, zoals een bedrijf of tip, met je naam en e-mailadres.',
        'Gebruiksgegevens: anonieme gebeurtenissen zoals paginaweergaven, zoekopdrachten en klikken op contactknoppen, gekoppeld aan een sessiecode.',
        'Als je ons via WhatsApp benadert: je telefoonnummer en de inhoud van je bericht.',
      ] },
      { h: 'Waarvoor gebruiken we je gegevens?', ul: [
        'Om je account aan te maken en je in te laten loggen met een inloglink (uitvoering van de overeenkomst).',
        'Om je hulpvraag door te sturen naar passende lokale aanbieders en gesprekken mogelijk te maken (uitvoering van de overeenkomst).',
        'Om bedrijfsprofielen te controleren en te tonen in de gids (uitvoering van de overeenkomst en gerechtvaardigd belang).',
        'Om aanbieders inzicht te geven in weergaven en contactmomenten, en om de website te verbeteren en te beveiligen (gerechtvaardigd belang).',
      ] },
      { h: 'Met wie delen we gegevens?', p: ['We verkopen je gegevens niet. Een hulpvraag delen we alleen met relevante, geverifieerde aanbieders. Voor de techniek gebruiken we dienstverleners die gegevens namens ons verwerken: Vercel (hosting van de website) en Supabase (database, inloggen en berichten). Met deze partijen gelden verwerkersafspraken. [Controleren en eventueel aanvullen, bijvoorbeeld met de e-maildienst voor inloglinks.]'] },
      { h: 'Hoe lang bewaren we je gegevens?', p: ['Accountgegevens bewaren we zolang je account bestaat. Hulpvragen, berichten en gebruiksgegevens bewaren we niet langer dan nodig. [Exacte bewaartermijnen invullen, bijvoorbeeld 24 maanden na de laatste activiteit.]'] },
      { h: 'Beveiliging', p: ['We nemen passende technische en organisatorische maatregelen om je gegevens te beschermen, zoals versleutelde verbindingen (HTTPS) en toegangsbeperking per account.'] },
      { h: 'Jouw rechten', p: ['Je hebt het recht om je gegevens in te zien, te laten corrigeren of te laten verwijderen. Je kunt ook bezwaar maken tegen het gebruik, vragen om beperking of je gegevens laten overdragen. Stuur je verzoek via de contactgegevens hierboven; we reageren binnen een maand.', 'Ben je het niet eens met hoe we met je gegevens omgaan? Dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens.'] },
      { h: 'Cookies', p: ['We gebruiken alleen functionele cookies. Lees meer in ons cookiebeleid.'] },
      { h: 'Wijzigingen', p: ['We kunnen deze verklaring aanpassen. De meest actuele versie staat altijd op deze pagina.'] },
    ],
  },
  en: {
    title: 'Privacy statement',
    description: 'How Uithoorn.online handles your personal data.',
    intro: 'Uithoorn.online is a local platform for Uithoorn and De Kwakel. We handle your data with care and only process what is needed to run the website. This statement explains which data that is, why we use it and what rights you have under the General Data Protection Regulation (GDPR).',
    sections: [
      { h: 'Who is responsible?', p: ['Uithoorn.online, based in Uithoorn, the Netherlands. [Fill in the business or owner name, address and Chamber of Commerce (KvK) number.]', `Contact: via WhatsApp on ${formatDutchMobile(WHATSAPP_NUMBER)} or by email at [fill in email address].`] },
      { h: 'What data do we process?', ul: [
        'Account details: name, email address, phone number (optional) and whether you are a customer or a provider.',
        'Business details of providers: business name, category, description, postcode, address, website and phone number.',
        'Help requests: category, job description, postcode, preferred timing, budget and urgency.',
        'Messages between residents and providers, and reviews after a completed job.',
        'Contributions you send through the website, such as a business or a tip, with your name and email address.',
        'Usage data: anonymous events such as page views, searches and clicks on contact buttons, linked to a session code.',
        'If you contact us on WhatsApp: your phone number and the content of your message.',
      ] },
      { h: 'What do we use your data for?', ul: [
        'To create your account and let you sign in with a sign-in link (performance of a contract).',
        'To forward your request to suitable local providers and enable conversations (performance of a contract).',
        'To check business profiles and show them in the directory (performance of a contract and legitimate interest).',
        'To give providers insight into views and contacts, and to improve and secure the website (legitimate interest).',
      ] },
      { h: 'Who do we share data with?', p: ['We never sell your data. We only share a request with relevant, verified providers. For the technology we use service providers that process data on our behalf: Vercel (website hosting) and Supabase (database, sign-in and messages). Data processing agreements apply. [Check and complete, for example with the email service for sign-in links.]'] },
      { h: 'How long do we keep your data?', p: ['We keep account details for as long as your account exists. We keep requests, messages and usage data no longer than necessary. [Fill in exact retention periods, for example 24 months after the last activity.]'] },
      { h: 'Security', p: ['We take appropriate technical and organisational measures to protect your data, such as encrypted connections (HTTPS) and per-account access restrictions.'] },
      { h: 'Your rights', p: ['You have the right to access, correct or delete your data. You can also object to its use, ask for restriction or request data portability. Send your request using the contact details above; we respond within one month.', 'Not happy with how we handle your data? You can file a complaint with the Dutch Data Protection Authority (Autoriteit Persoonsgegevens).'] },
      { h: 'Cookies', p: ['We only use functional cookies. Read more in our cookie policy.'] },
      { h: 'Changes', p: ['We may update this statement. The latest version is always on this page.'] },
    ],
  },
};

const PATH = '/privacy';
const OTHER: string = '/cookies';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return { title: content[lang].title, description: content[lang].description, alternates: alternatesFor(lang, PATH) };
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
