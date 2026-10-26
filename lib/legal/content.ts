// Legal texts (DRAFTS, to be reviewed by a lawyer before launch). NL is leading; EN is a translation.
// Placeholders in [brackets] must be filled in by the owner. No KvK number is shown because none
// exists yet; add `kvk` and `vat` to COMPANY once registered.
import type { Locale } from '../i18n/config';

export const LEGAL_LAST_UPDATED = '2026-10-26';

export const COMPANY = {
  tradeName: 'Uithoorn.online',
  legalName: '[Naam van de onderneming / eigenaar – in te vullen]',
  address: '[Straat en huisnummer, postcode, plaats – in te vullen]',
  email: '[E-mailadres – in te vullen, bijv. hello@uithoorn.online]',
  kvk: null as string | null,
  vat: null as string | null,
};

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

const C = COMPANY;

const privacyNl: LegalDoc = {
  title: 'Privacyverklaring',
  intro: `${C.tradeName} is een lokaal platform voor Uithoorn en De Kwakel. Hier lees je welke persoonsgegevens we verwerken, waarom, hoe lang we ze bewaren en welke rechten je hebt. We houden ons aan de Algemene verordening gegevensbescherming (AVG).`,
  sections: [
    { heading: '1. Wie is verantwoordelijk?', body: [
      `Verwerkingsverantwoordelijke: ${C.legalName}, handelend onder de naam ${C.tradeName}, ${C.address}. E-mail: ${C.email}. Je kunt ons ook bereiken via het contactformulier op /contact.`,
      'We hebben geen functionaris voor gegevensbescherming aangesteld; dat is voor een organisatie van onze omvang niet verplicht. Vragen over privacy kun je via de contactgegevens hierboven stellen.',
    ] },
    { heading: '2. Welke gegevens verwerken we?', body: [
      'Account: naam, e-mailadres, telefoonnummer (optioneel), rol (bewoner of ondernemer), taalvoorkeur, een versleutelde (gehashte) versie van je wachtwoord, en het moment van registratie, laatste login en akkoord met de voorwaarden.',
      'Hulpvragen: de categorie, omschrijving, postcode, gewenste planning, urgentie en het eventuele budget dat je invult.',
      'Gesprekken en beoordelingen: berichten tussen jou en een aanbieder, en beoordelingen die je achterlaat (je voornaam is bij een beoordeling openbaar).',
      'Bedrijfsvermeldingen: bedrijfsnaam, categorie, omschrijving, adres/postcode, website en telefoonnummer. Deze gegevens zijn openbaar zodra een vermelding is goedgekeurd. Bij eenmanszaken kunnen dit persoonsgegevens zijn.',
      'Contactberichten en inzendingen: je naam, e-mailadres en bericht.',
      'Technische gegevens: om misbruik te voorkomen tellen we kortstondig het aantal verzoeken per IP-adres en per e-mailadres. We slaan daarbij alleen een onleesbare hash op, niet het IP-adres zelf. Daarnaast tellen we anoniem paginabezoeken (zonder cookies, zie artikel 7).',
    ] },
    { heading: '3. Waarvoor en op welke grondslag?', body: [
      'Je account aanmaken en beheren, hulpvragen doorsturen naar passende lokale aanbieders, gesprekken en beoordelingen mogelijk maken: noodzakelijk voor de uitvoering van de overeenkomst (art. 6 lid 1 sub b AVG).',
      'E-mails die bij de dienst horen (inloglink, nieuwe aanvraag, nieuw bericht, besluit over je vermelding): uitvoering van de overeenkomst.',
      'Beveiliging, fraude- en spampreventie (rate limiting, honeypot), moderatie van inhoud en anonieme bezoekersstatistieken: gerechtvaardigd belang (art. 6 lid 1 sub f AVG). Ons belang is een veilig, betrouwbaar en goed werkend platform.',
      'Administratie van betaalde pakketten (zodra die er zijn): wettelijke verplichting (fiscale bewaarplicht).',
      'We sturen geen nieuwsbrieven of reclame en verkopen je gegevens niet. We nemen geen besluiten die uitsluitend op geautomatiseerde verwerking zijn gebaseerd; het koppelen van een aanvraag aan aanbieders gebeurt op basis van categorie en postcode, en je kiest zelf met wie je verder gaat.',
    ] },
    { heading: '4. Met wie delen we gegevens?', body: [
      'Met lokale aanbieders: als je een hulpvraag plaatst, zien passende aanbieders de omschrijving, categorie, postcode, planning en het budget. Je naam en e-mailadres zien ze niet; contact verloopt via het berichtensysteem nadat een aanbieder je aanvraag heeft geaccepteerd.',
      'Met verwerkers die ons helpen de dienst te leveren, op basis van een verwerkersovereenkomst: Vercel Inc. (hosting van de website en anonieme bezoekersstatistieken; servers in de EU en de VS), Neon Inc. (database; opslag in de EU, regio Frankfurt, Duitsland), Resend (verzenden van e-mail; VS) en Tab (tab.bot), de digitale assistent die de beheerdersmailbox van Uithoorn.online leest en meldingen over nieuwe aanvragen, aanmeldingen en berichten verwerkt.',
      'Waar een verwerker gegevens buiten de Europese Economische Ruimte verwerkt (bijvoorbeeld in de Verenigde Staten), gebeurt dat op basis van het EU-VS Data Privacy Framework of de standaardcontractbepalingen van de Europese Commissie. [Eigenaar: verwerkersovereenkomsten met Vercel, Neon en Resend afsluiten en hier controleren.]',
      'Als je ons via WhatsApp benadert, verwerkt WhatsApp (Meta) je gegevens volgens het eigen privacybeleid van WhatsApp.',
      'We verstrekken gegevens aan instanties als de wet ons daartoe verplicht.',
    ] },
    { heading: '5. Hoe lang bewaren we je gegevens?', body: [
      'Account: zolang je account bestaat. Accounts van bewoners die 36 maanden niet zijn gebruikt en geen bedrijf hebben, verwijderen we automatisch.',
      'Hulpvragen, de bijbehorende leads, gesprekken en berichten: 24 maanden na het plaatsen van de hulpvraag.',
      'Beoordelingen: zolang de vermelding van het bedrijf bestaat, tenzij je ze eerder laat verwijderen of je account verwijdert.',
      'Contactberichten en inzendingen: 24 maanden.',
      'Anonieme statistieken: 26 maanden. Logboek van verzonden e-mails: 12 maanden. Logboek van beheerdersacties: 24 maanden.',
      'Facturen en betaalgegevens (zodra betaalde pakketten online worden afgerekend): 7 jaar, vanwege de fiscale bewaarplicht.',
      'Back-ups: de database maakt automatisch herstelpunten die na korte tijd worden overschreven; handmatige back-ups bewaren we maximaal 30 dagen.',
    ] },
    { heading: '6. Beveiliging', body: [
      'We gebruiken versleutelde verbindingen (HTTPS/TLS), wachtwoorden worden alleen gehasht opgeslagen (scrypt), sessies lopen via veilige cookies die niet door scripts kunnen worden gelezen, en alleen de server heeft toegang tot de database. Toegang tot beheerfuncties is beperkt tot beheerders en wordt gelogd.',
    ] },
    { heading: '7. Cookies en statistieken', body: [
      'We gebruiken alleen functionele cookies die nodig zijn om de site te laten werken (inloggen en taalkeuze). We gebruiken geen tracking-, advertentie- of analysecookies. Voor statistieken gebruiken we Vercel Web Analytics, dat geen cookies plaatst en geen bezoekers over websites heen volgt. Zie ons cookiebeleid.',
    ] },
    { heading: '8. Je rechten', body: [
      'Je hebt recht op inzage, correctie, verwijdering, beperking van de verwerking, overdraagbaarheid van je gegevens en bezwaar tegen verwerking op basis van gerechtvaardigd belang.',
      'Veel kun je zelf regelen onder Accountinstellingen: je gegevens aanpassen, al je gegevens downloaden (JSON) en je account definitief verwijderen.',
      'Voor andere verzoeken kun je contact met ons opnemen. We reageren binnen een maand. We kunnen je vragen je identiteit te bevestigen.',
      'Ben je het niet eens met hoe we met je gegevens omgaan? Dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).',
    ] },
    { heading: '9. Wijzigingen', body: [
      'We kunnen deze privacyverklaring aanpassen. De datum bovenaan laat zien wanneer dat voor het laatst is gebeurd. Bij belangrijke wijzigingen informeren we geregistreerde gebruikers per e-mail.',
    ] },
  ],
};

const privacyEn: LegalDoc = {
  title: 'Privacy policy',
  intro: `${C.tradeName} is a local platform for Uithoorn and De Kwakel. This policy explains which personal data we process, why, how long we keep it and what your rights are. We comply with the EU General Data Protection Regulation (GDPR, in Dutch: AVG). The Dutch version is leading.`,
  sections: [
    { heading: '1. Who is responsible?', body: [
      `Controller: ${C.legalName}, trading as ${C.tradeName}, ${C.address}. Email: ${C.email}. You can also reach us through the contact form at /en/contact.`,
      'We have not appointed a data protection officer, which is not required for an organisation of our size. Privacy questions can be sent to the contact details above.',
    ] },
    { heading: '2. Which data do we process?', body: [
      'Account: name, email address, phone number (optional), role (resident or business), language preference, a hashed version of your password, and when you registered, last logged in and accepted the terms.',
      'Help requests: category, description, postcode, preferred timing, urgency and any budget you enter.',
      'Conversations and reviews: messages between you and a business, and reviews you leave (your first name is public on a review).',
      'Business listings: business name, category, description, address/postcode, website and phone number. These are public once a listing is approved. For sole traders these can be personal data.',
      'Contact messages and submissions: your name, email address and message.',
      'Technical data: to prevent abuse we briefly count requests per IP address and per email address, storing only an unreadable hash, not the IP address itself. We also count page visits anonymously (without cookies, see section 7).',
    ] },
    { heading: '3. Purposes and legal bases', body: [
      'Creating and managing your account, forwarding help requests to suitable local businesses, enabling conversations and reviews: necessary for the performance of the contract (Art. 6(1)(b) GDPR).',
      'Service emails (sign-in link, new request, new message, decision on your listing): performance of the contract.',
      'Security, fraud and spam prevention (rate limiting, honeypot), content moderation and anonymous visitor statistics: legitimate interest (Art. 6(1)(f) GDPR) in a safe, reliable and well-functioning platform.',
      'Administration of paid plans (once available): legal obligation (tax record-keeping).',
      'We do not send newsletters or advertising and we do not sell your data. We do not take decisions based solely on automated processing; matching a request to businesses uses category and postcode, and you choose who to continue with.',
    ] },
    { heading: '4. Who do we share data with?', body: [
      "Local businesses: when you post a help request, matching businesses see the description, category, postcode, timing and budget. They do not see your name or email address; contact happens through the messaging system after a business accepts your request.",
      'Processors that help us deliver the service, under a data processing agreement: Vercel Inc. (website hosting and anonymous visitor statistics; servers in the EU and US), Neon Inc. (database; stored in the EU, Frankfurt region, Germany), Resend (email delivery; US) and Tab (tab.bot), the digital assistant that reads the Uithoorn.online operations mailbox and handles notifications about new requests, sign-ups and messages.',
      'Where a processor handles data outside the European Economic Area (for example in the United States), this is based on the EU-US Data Privacy Framework or the European Commission’s standard contractual clauses. [Owner: sign data processing agreements with Vercel, Neon and Resend and verify here.]',
      'If you contact us via WhatsApp, WhatsApp (Meta) processes your data under its own privacy policy.',
      'We disclose data to authorities where the law requires it.',
    ] },
    { heading: '5. How long do we keep your data?', body: [
      'Account: as long as your account exists. Resident accounts unused for 36 months and without a business are deleted automatically.',
      'Help requests, their leads, conversations and messages: 24 months after the request was posted.',
      'Reviews: as long as the business listing exists, unless you have them removed earlier or delete your account.',
      'Contact messages and submissions: 24 months.',
      'Anonymous statistics: 26 months. Email delivery log: 12 months. Admin action log: 24 months.',
      'Invoices and payment records (once paid plans are billed online): 7 years, due to tax law.',
      'Backups: the database keeps automatic restore points that are overwritten after a short period; manual backups are kept for at most 30 days.',
    ] },
    { heading: '6. Security', body: [
      'We use encrypted connections (HTTPS/TLS), passwords are stored only as hashes (scrypt), sessions use secure cookies that scripts cannot read, and only the server can access the database. Access to admin functions is limited to administrators and logged.',
    ] },
    { heading: '7. Cookies and statistics', body: [
      'We only use functional cookies needed for the site to work (login and language choice). We use no tracking, advertising or analytics cookies. For statistics we use Vercel Web Analytics, which sets no cookies and does not track visitors across websites. See our cookie policy.',
    ] },
    { heading: '8. Your rights', body: [
      'You have the right of access, rectification, erasure, restriction of processing, data portability and to object to processing based on legitimate interest.',
      'Much of this you can do yourself under Account settings: edit your details, download all your data (JSON) and permanently delete your account.',
      'For other requests, contact us. We respond within one month and may ask you to confirm your identity.',
      'If you disagree with how we handle your data, you can lodge a complaint with the Dutch Data Protection Authority (Autoriteit Persoonsgegevens, autoriteitpersoonsgegevens.nl).',
    ] },
    { heading: '9. Changes', body: [
      'We may update this policy. The date at the top shows when it was last changed. We will email registered users about significant changes.',
    ] },
  ],
};

const cookiesNl: LegalDoc = {
  title: 'Cookiebeleid',
  intro: `${C.tradeName} gebruikt zo min mogelijk cookies. We plaatsen alleen functionele cookies die nodig zijn om de site te laten werken. Daarvoor is volgens de Telecommunicatiewet geen toestemming nodig, en daarom zie je bij ons geen cookiebanner.`,
  sections: [
    { heading: '1. Welke cookies gebruiken we?', body: [
      'uo_session – houdt je ingelogd. Functioneel/strikt noodzakelijk. Bevat alleen een willekeurige sleutel, geen persoonsgegevens. Geldig tot je uitlogt of maximaal 30 dagen. Alleen gezet als je inlogt.',
      'uithoorn-locale – onthoudt of je de site in het Nederlands of Engels wilt zien. Functioneel. Alleen gezet als je zelf van taal wisselt.',
    ] },
    { heading: '2. Statistieken zonder cookies', body: [
      'We meten bezoekersaantallen met Vercel Web Analytics. Dat werkt zonder cookies en zonder bezoekers over websites heen te volgen; er wordt geen persoonlijk profiel gemaakt. Daarnaast tellen we op onze eigen server anoniem gebeurtenissen zoals een geplaatste aanvraag, zonder IP-adres of identificatie op te slaan.',
    ] },
    { heading: '3. Cookies van derden', body: [
      'We gebruiken geen advertentie-, tracking- of social-media-cookies. Als je op een WhatsApp-knop klikt, verlaat je onze site en gelden de voorwaarden en het cookiebeleid van WhatsApp.',
    ] },
    { heading: '4. Cookies beheren', body: [
      'Je kunt cookies verwijderen of blokkeren in de instellingen van je browser. Als je functionele cookies blokkeert, kun je niet inloggen en wordt je taalkeuze niet onthouden.',
      'Gaan we in de toekomst cookies gebruiken waarvoor toestemming nodig is, dan vragen we die eerst via een cookiebanner en passen we dit beleid aan.',
    ] },
  ],
};

const cookiesEn: LegalDoc = {
  title: 'Cookie policy',
  intro: `${C.tradeName} uses as few cookies as possible. We only set functional cookies that the site needs to work. Under Dutch law (Telecommunicatiewet) these do not require consent, which is why you will not see a cookie banner here. The Dutch version is leading.`,
  sections: [
    { heading: '1. Which cookies do we use?', body: [
      'uo_session – keeps you logged in. Functional/strictly necessary. Contains only a random key, no personal data. Valid until you log out or for at most 30 days. Only set when you log in.',
      'uithoorn-locale – remembers whether you want the site in Dutch or English. Functional. Only set when you switch language yourself.',
    ] },
    { heading: '2. Statistics without cookies', body: [
      'We measure visitor numbers with Vercel Web Analytics, which works without cookies and does not track visitors across websites; no personal profile is built. On our own server we also count events such as a submitted request anonymously, without storing IP addresses or identifiers.',
    ] },
    { heading: '3. Third-party cookies', body: [
      'We use no advertising, tracking or social media cookies. When you click a WhatsApp button you leave our site and WhatsApp’s terms and cookie policy apply.',
    ] },
    { heading: '4. Managing cookies', body: [
      'You can delete or block cookies in your browser settings. If you block functional cookies, you cannot log in and your language choice is not remembered.',
      'If we ever use cookies that need consent, we will ask for it first through a cookie banner and update this policy.',
    ] },
  ],
};

const termsNl: LegalDoc = {
  title: 'Algemene voorwaarden',
  intro: `Deze voorwaarden gelden voor het gebruik van ${C.tradeName} door bewoners (gebruikers) en ondernemers (aanbieders). Door een account aan te maken ga je ermee akkoord.`,
  sections: [
    { heading: '1. Wie zijn wij?', body: [
      `${C.tradeName} is een dienst van ${C.legalName}, ${C.address}. E-mail: ${C.email}. [KvK-nummer en btw-nummer toevoegen zodra de onderneming is ingeschreven.]`,
    ] },
    { heading: '2. Wat doet Uithoorn.online?', body: [
      'Uithoorn.online is een online platform dat bewoners van Uithoorn en De Kwakel in contact brengt met lokale bedrijven. Bewoners kunnen bedrijven vinden en hulpvragen plaatsen; aanbieders kunnen zich presenteren en op hulpvragen reageren.',
      'Wij zijn geen partij bij afspraken of overeenkomsten tussen een bewoner en een aanbieder. De aanbieder is zelf verantwoordelijk voor de uitvoering, prijs, kwaliteit en eventuele garantie van zijn diensten.',
    ] },
    { heading: '3. Account', body: [
      'Je moet minimaal 16 jaar oud zijn om een account aan te maken. Je geeft juiste gegevens op en houdt je wachtwoord geheim. Je bent verantwoordelijk voor wat er via je account gebeurt.',
      'Je kunt je account op elk moment zelf verwijderen via Accountinstellingen.',
    ] },
    { heading: '4. Regels voor gebruik', body: [
      'Je gebruikt het platform niet voor onrechtmatige, misleidende, beledigende of discriminerende inhoud, spam of reclame die niet bij een hulpvraag of vermelding hoort. Je plaatst geen gegevens van anderen zonder hun toestemming.',
      'Beoordelingen moeten gaan over een echte ervaring en eerlijk zijn. Je mag geen beoordelingen schrijven over je eigen bedrijf of tegen betaling.',
      'We mogen hulpvragen, berichten, beoordelingen en vermeldingen verbergen of verwijderen en accounts blokkeren als deze regels worden overtreden of als we daartoe wettelijk verplicht zijn. Waar mogelijk laten we je weten waarom.',
    ] },
    { heading: '5. Extra voorwaarden voor aanbieders', body: [
      'Elke bedrijfsvermelding wordt gecontroleerd voordat die openbaar wordt. Het label “Geverifieerd” betekent dat wij de basisgegevens van het bedrijf hebben gecontroleerd; het is geen keurmerk voor de kwaliteit van het werk.',
      'Je bent verantwoordelijk voor de juistheid van je vermelding en voor het naleven van de wet bij het uitvoeren van opdrachten, waaronder consumentenrecht, belasting- en vergunningsregels.',
      'Pakketten: Gratis (€0, 3 leads per kalendermaand), Pro (€29 per maand, 15 leads per maand) en Pro+ (€59 per maand, 50 leads per maand, met uitgelichte plaatsing). [Prijzen inclusief/exclusief btw – in te vullen.] Een lead is een hulpvraag die aan jouw bedrijf wordt doorgestuurd. Komen er meer leads binnen dan je pakket toestaat, dan zie je dat er een aanvraag is, maar niet de inhoud, totdat je upgradet.',
      'Betaling gebeurt vooralsnog per factuur of betaalverzoek na contact via WhatsApp of het contactformulier. Pakketten lopen per maand en zijn maandelijks opzegbaar tegen het einde van de lopende maand. Reeds betaalde maanden worden niet terugbetaald, tenzij de wet anders bepaalt.',
      'We kunnen prijzen en pakketten wijzigen. Een prijsverhoging laten we minimaal 30 dagen van tevoren weten; je kunt dan opzeggen voordat de wijziging ingaat.',
      'Als aanbieder verwerk je persoonsgegevens van bewoners die je via het platform ontvangt als zelfstandig verantwoordelijke. Je gebruikt ze alleen om op de hulpvraag te reageren en de opdracht uit te voeren.',
    ] },
    { heading: '6. Beschikbaarheid', body: [
      'We doen ons best om het platform goed en veilig te laten werken, maar kunnen niet garanderen dat het altijd beschikbaar en foutloos is. We kunnen functies aanpassen of beëindigen.',
    ] },
    { heading: '7. Aansprakelijkheid', body: [
      'We zijn niet aansprakelijk voor het werk, de producten of het gedrag van aanbieders of bewoners, of voor schade die ontstaat uit afspraken tussen hen.',
      'Onze aansprakelijkheid is in alle gevallen beperkt tot het bedrag dat je in de 12 maanden voorafgaand aan de schade aan ons hebt betaald, of tot €100 als je niets hebt betaald. Deze beperking geldt niet bij opzet of grove schuld, of voor zover dwingend consumentenrecht dat niet toestaat.',
    ] },
    { heading: '8. Klachten', body: [
      'Heb je een klacht over het platform? Neem contact op via /contact. We reageren binnen 14 dagen. Klachten over het werk van een aanbieder los je in eerste instantie met de aanbieder zelf op.',
    ] },
    { heading: '9. Wijzigingen', body: [
      'We kunnen deze voorwaarden wijzigen. Belangrijke wijzigingen laten we minimaal 30 dagen van tevoren per e-mail weten. Gebruik je het platform daarna nog, dan gelden de nieuwe voorwaarden.',
    ] },
    { heading: '10. Toepasselijk recht', body: [
      'Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement Noord-Holland, tenzij je als consument een andere bevoegde rechter mag kiezen.',
    ] },
  ],
};

const termsEn: LegalDoc = {
  title: 'Terms and conditions',
  intro: `These terms apply to the use of ${C.tradeName} by residents (users) and businesses (providers). By creating an account you agree to them. The Dutch version (Algemene voorwaarden) is leading.`,
  sections: [
    { heading: '1. Who are we?', body: [
      `${C.tradeName} is a service of ${C.legalName}, ${C.address}. Email: ${C.email}. [Add the KvK (Chamber of Commerce) and VAT numbers once the business is registered.]`,
    ] },
    { heading: '2. What does Uithoorn.online do?', body: [
      'Uithoorn.online is an online platform that connects residents of Uithoorn and De Kwakel with local businesses. Residents can find businesses and post help requests; providers can present themselves and respond to requests.',
      'We are not a party to any arrangement or contract between a resident and a provider. The provider is responsible for the execution, price, quality and any guarantee of its services.',
    ] },
    { heading: '3. Account', body: [
      'You must be at least 16 years old to create an account. You provide accurate details and keep your password secret. You are responsible for activity on your account.',
      'You can delete your account at any time under Account settings.',
    ] },
    { heading: '4. Rules of use', body: [
      'Do not use the platform for unlawful, misleading, offensive or discriminatory content, spam, or advertising unrelated to a request or listing. Do not post other people’s data without their consent.',
      'Reviews must reflect a genuine experience and be fair. You may not review your own business or write reviews for payment.',
      'We may hide or remove requests, messages, reviews and listings, and block accounts, if these rules are broken or the law requires it. Where possible we will tell you why.',
    ] },
    { heading: '5. Additional terms for providers', body: [
      'Every business listing is reviewed before it becomes public. The “Verified” label means we have checked the basic business details; it is not a quality mark for the work.',
      'You are responsible for the accuracy of your listing and for complying with the law when carrying out work, including consumer, tax and licensing rules.',
      'Plans: Free (€0, 3 leads per calendar month), Pro (€29 per month, 15 leads per month) and Pro+ (€59 per month, 50 leads per month, with featured placement). [Prices including/excluding VAT – to be filled in.] A lead is a help request forwarded to your business. If more leads arrive than your plan allows, you see that a request came in, but not its content, until you upgrade.',
      'For now, payment is by invoice or payment request after contact via WhatsApp or the contact form. Plans run monthly and can be cancelled at the end of the current month. Months already paid are not refunded unless the law requires otherwise.',
      'We may change prices and plans. We announce a price increase at least 30 days in advance; you may cancel before it takes effect.',
      'As a provider you process the personal data of residents you receive through the platform as an independent controller. You use it only to respond to the request and carry out the job.',
    ] },
    { heading: '6. Availability', body: [
      'We do our best to keep the platform working well and securely, but cannot guarantee it is always available and error-free. We may change or discontinue features.',
    ] },
    { heading: '7. Liability', body: [
      'We are not liable for the work, products or conduct of providers or residents, or for damage arising from arrangements between them.',
      'Our liability is in all cases limited to the amount you paid us in the 12 months before the damage, or €100 if you paid nothing. This limitation does not apply in case of intent or gross negligence, or where mandatory consumer law does not allow it.',
    ] },
    { heading: '8. Complaints', body: [
      'Have a complaint about the platform? Contact us via /en/contact. We respond within 14 days. Complaints about a provider’s work should first be resolved with the provider.',
    ] },
    { heading: '9. Changes', body: [
      'We may change these terms. We will email you about significant changes at least 30 days in advance. If you keep using the platform afterwards, the new terms apply.',
    ] },
    { heading: '10. Governing law', body: [
      'These terms are governed by Dutch law. Disputes are submitted to the competent court in the district of Noord-Holland, unless as a consumer you are entitled to choose another competent court.',
    ] },
  ],
};

export type LegalKind = 'privacy' | 'cookies' | 'terms';
const docs: Record<LegalKind, Record<Locale, LegalDoc>> = {
  privacy: { nl: privacyNl, en: privacyEn },
  cookies: { nl: cookiesNl, en: cookiesEn },
  terms: { nl: termsNl, en: termsEn },
};

export function getLegalDoc(kind: LegalKind, lang: Locale): LegalDoc {
  return docs[kind][lang];
}
