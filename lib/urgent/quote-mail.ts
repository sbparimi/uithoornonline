import 'server-only';
import { layout, localPath, siteUrl, type Lang } from '../email/templates';
import { acceptUrl, statusUrl, urgencyLabel } from './mail';
import { priceText, type Answer, type JobBrief } from './ai-request';

// Email texts for the AI request flow for all jobs (docs/AI_REQUESTS.md): quote requests to businesses
// (with the AI job brief), new-quote and review-request emails to customers. Branded layout as mail.ts.
const L = (lang: Lang, nl: string, en: string) => (lang === 'en' ? en : nl);
const pq = () => (process.env.PREVIEW_LINK_QUERY ? `?${process.env.PREVIEW_LINK_QUERY}` : '');
export const reviewUrl = (lang: Lang, token: string) => `${siteUrl()}${localPath(lang, `/beoordeling/${token}`)}${pq()}`;

type Job = { category: string; categoryLabel: string; summary: string; postcode: string; urgency: string | null; createdAt: string };
const area = (j: Job) => `${j.postcode.slice(0, 4)} (Uithoorn e.o.)`;
export const euro = (lang: Lang, cents: number) => `€${(cents / 100).toLocaleString(lang === 'en' ? 'en-GB' : 'nl-NL', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function quoteRequestEmail(lang: Lang, businessName: string, j: Job, brief: JobBrief | null, answers: Answer[], token: string, round: number) {
  const rows: [string, string][] = [
    [L(lang, 'Wat', 'What'), j.categoryLabel],
    [L(lang, 'Wanneer', 'When'), urgencyLabel(lang, j.urgency)],
    [L(lang, 'Waar', 'Where'), area(j)],
    ...((brief?.facts?.length ? brief.facts : answers.map((a) => [a.q, a.a] as [string, string])).slice(0, 6)),
  ];
  if (brief?.price) rows.push([L(lang, 'Indicatie (AI-schatting)', 'Indication (AI estimate)'), priceText(lang, brief.price)]);
  return layout(lang, L(lang, `Offerteaanvraag: ${j.categoryLabel} in ${j.postcode.slice(0, 4)}`, `Quote request: ${j.categoryLabel} in ${j.postcode.slice(0, 4)}`), {
    heading: L(lang, `Nieuwe offerteaanvraag voor ${businessName}`, `New quote request for ${businessName}`),
    paragraphs: [
      round > 1
        ? L(lang, `Een inwoner zoekt nog een vakman. Je hoort bij de 3 best passende bedrijven die we nu vragen.`, `A resident is still looking for a professional. You are one of the 3 best-matching businesses we are asking now.`)
        : L(lang, 'Een inwoner zoekt een vakman. Je hoort bij de 3 best passende bedrijven die deze aanvraag krijgen.', 'A resident is looking for a professional. You are one of the 3 best-matching businesses that get this request.'),
      L(lang, 'Stuur met één klik een offerte (bedrag, bericht en wanneer je kunt). Inloggen is niet nodig. De klant vergelijkt de offertes en kiest. Daarna krijg je de contactgegevens.', 'Send a quote in one click (amount, message and when you can start). No login needed. The customer compares the quotes and picks one. Then you get their contact details.'),
    ],
    quote: brief?.summary || j.summary,
    rows,
    button: { label: L(lang, 'Bekijk de klus en stuur een offerte', 'View the job and send a quote'), url: acceptUrl(lang, token) },
    note: L(lang, 'De samenvatting en de prijsindicatie zijn door AI gemaakt op basis van wat de klant schreef. Controleer ze altijd zelf. Geen tijd? Tik op "Niet beschikbaar", dan vragen we een ander bedrijf.', 'The summary and price indication were written by AI from what the customer wrote. Always check them yourself. No time? Tap "Not available" and we ask another business.'),
  });
}

export function quoteConfirmationEmail(lang: Lang, j: Job, invited: number, statusToken: string) {
  return layout(lang, L(lang, `Je aanvraag is ontvangen: ${j.categoryLabel}`, `We received your request: ${j.categoryLabel}`), {
    heading: L(lang, 'We vragen nu offertes voor je op', "We're getting quotes for you"),
    paragraphs: [
      invited > 0
        ? L(lang, `We hebben je aanvraag naar de ${invited} best passende lokale ${invited === 1 ? 'vakman' : 'vakmensen'} gestuurd. Zodra er een offerte binnenkomt, krijg je een e-mail. Je vergelijkt de offertes op je statuspagina en kiest zelf.`, `We sent your request to the ${invited} best-matching local ${invited === 1 ? 'professional' : 'professionals'}. You get an email as soon as a quote comes in. Compare the quotes on your status page and choose.`)
        : L(lang, 'We zoeken passende lokale bedrijven en laten het je weten zodra er een offerte is.', "We're finding matching local businesses and will let you know as soon as there is a quote."),
      L(lang, 'Reageert er binnen 24 uur niemand, dan vragen we automatisch de volgende 3 bedrijven.', 'If nobody responds within 24 hours, we automatically ask the next 3 businesses.'),
    ],
    quote: j.summary,
    rows: [[L(lang, 'Wat', 'What'), j.categoryLabel], [L(lang, 'Wanneer', 'When'), urgencyLabel(lang, j.urgency)], [L(lang, 'Waar', 'Where'), area(j)]],
    button: { label: L(lang, 'Bekijk je aanvraag en offertes', 'View your request and quotes'), url: statusUrl(lang, statusToken) },
    note: L(lang, 'Je contactgegevens gaan pas naar een bedrijf als je zijn offerte kiest.', 'Your contact details only go to a business once you choose its quote.'),
  });
}

export function newQuoteEmail(lang: Lang, j: Job, q: { businessName: string; amountCents: number | null; priceType: string; message: string; availableFrom: string | null }, count: number, statusToken: string) {
  const price = q.amountCents === null ? L(lang, 'Prijs na bezichtiging', 'Price after a visit') : `${q.priceType === 'from' ? L(lang, 'vanaf ', 'from ') : ''}${euro(lang, q.amountCents)}${q.priceType === 'hourly' ? L(lang, ' per uur', ' per hour') : ''}`;
  const rows: [string, string][] = [[L(lang, 'Bedrijf', 'Business'), q.businessName], [L(lang, 'Prijs', 'Price'), price]];
  if (q.availableFrom) rows.push([L(lang, 'Kan starten', 'Can start'), new Date(q.availableFrom).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'long' })]);
  return layout(lang, L(lang, `Nieuwe offerte van ${q.businessName}`, `New quote from ${q.businessName}`), {
    heading: L(lang, `${q.businessName} heeft een offerte gestuurd`, `${q.businessName} sent you a quote`),
    paragraphs: [count > 1 ? L(lang, `Je hebt nu ${count} offertes voor je ${j.categoryLabel.toLowerCase()}-klus. Vergelijk ze naast elkaar en kies er één.`, `You now have ${count} quotes for your ${j.categoryLabel.toLowerCase()} job. Compare them side by side and choose one.`) : L(lang, 'Je eerste offerte is binnen. Wacht eventueel op meer offertes, of kies deze meteen.', 'Your first quote is in. Wait for more quotes if you like, or choose this one right away.')],
    quote: q.message || undefined,
    rows,
    button: { label: L(lang, 'Vergelijk en kies', 'Compare and choose'), url: statusUrl(lang, statusToken) },
  });
}

export function quoteNotChosenEmail(lang: Lang, j: Job) {
  return layout(lang, L(lang, `Klant heeft gekozen: ${j.categoryLabel} (${j.postcode.slice(0, 4)})`, `Customer has chosen: ${j.categoryLabel} (${j.postcode.slice(0, 4)})`), {
    heading: L(lang, 'De klant heeft een ander bedrijf gekozen', 'The customer chose another business'),
    paragraphs: [L(lang, 'Bedankt voor je reactie. Deze keer koos de klant een ander bedrijf. Goede beoordelingen van eerdere klanten helpen je om vaker gekozen te worden.', 'Thanks for responding. This time the customer chose another business. Good reviews from past customers help you get chosen more often.')],
    rows: [[L(lang, 'Wat', 'What'), j.categoryLabel], [L(lang, 'Waar', 'Where'), area(j)]],
  });
}

export function nextRoundEmail(lang: Lang, j: Job, invited: number, statusToken: string) {
  return layout(lang, L(lang, `We vragen nog ${invited} bedrijven: ${j.categoryLabel}`, `We're asking ${invited} more businesses: ${j.categoryLabel}`), {
    heading: L(lang, 'We zoeken verder voor je', "We're still looking for you"),
    paragraphs: [L(lang, `Er kwam nog geen offerte binnen, dus hebben we je aanvraag nu ook naar ${invited} andere lokale ${invited === 1 ? 'bedrijf' : 'bedrijven'} gestuurd.`, `No quote came in yet, so we've now also sent your request to ${invited} other local ${invited === 1 ? 'business' : 'businesses'}.`)],
    button: { label: L(lang, 'Bekijk je aanvraag', 'View your request'), url: statusUrl(lang, statusToken) },
  });
}

export function noQuotesEmail(lang: Lang, j: Job, statusToken: string) {
  return layout(lang, L(lang, `Nog geen offerte: ${j.categoryLabel}`, `No quote yet: ${j.categoryLabel}`), {
    heading: L(lang, 'Ons team zoekt persoonlijk verder', 'Our team is looking personally'),
    paragraphs: [L(lang, 'Helaas heeft nog geen enkel bedrijf een offerte gestuurd. Ons team is gewaarschuwd en zoekt persoonlijk een vakman voor je. Je hoort van ons.', 'Unfortunately no business has sent a quote yet. Our team has been alerted and is personally looking for a professional. You will hear from us.')],
    button: { label: L(lang, 'Bekijk je aanvraag', 'View your request'), url: statusUrl(lang, statusToken) },
  });
}

export function reviewRequestEmail(lang: Lang, businessName: string, j: Job, token: string) {
  return layout(lang, L(lang, `Hoe was ${businessName}? Laat een beoordeling achter`, `How was ${businessName}? Leave a review`), {
    heading: L(lang, `Hoe heeft ${businessName} het gedaan?`, `How did ${businessName} do?`),
    paragraphs: [
      L(lang, `Je ${j.categoryLabel.toLowerCase()}-klus is afgerond. Help andere inwoners van Uithoorn en De Kwakel met een eerlijke beoordeling. Het kost 30 seconden.`, `Your ${j.categoryLabel.toLowerCase()} job is done. Help other residents of Uithoorn and De Kwakel with an honest review. It takes 30 seconds.`),
      L(lang, 'Je beoordeling krijgt het label "Geverifieerde klus", omdat hij bij een echte klus via Uithoorn.online hoort. Alleen je voornaam is zichtbaar.', 'Your review gets the "Verified job" label because it belongs to a real job via Uithoorn.online. Only your first name is shown.'),
    ],
    button: { label: L(lang, 'Geef een beoordeling', 'Leave a review'), url: reviewUrl(lang, token) },
  });
}
