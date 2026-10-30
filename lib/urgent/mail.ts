import 'server-only';
import { layout, localPath, siteUrl, type Lang } from '../email/templates';

// Email texts for urgent handling (branded layout from lib/email/templates.ts).
const L = (lang: Lang, nl: string, en: string) => (lang === 'en' ? en : nl);
export const URGENCY_LABEL: Record<string, [string, string]> = {
  spoed: ['🚨 SPOED (nu)', '🚨 URGENT (now)'], today: ['Vandaag', 'Today'], week: ['Deze week', 'This week'], flexible: ['Flexibel', 'Flexible'],
};
export const urgencyLabel = (lang: Lang, level: string | null) => URGENCY_LABEL[level ?? 'flexible']?.[lang === 'en' ? 1 : 0] ?? (level ?? '');
// Previews sit behind Vercel's login; PREVIEW_LINK_QUERY (e.g. "_vercel_share=…", previews only) is added
// to links in alerts so a tester can open them on a phone. Never set in production.
const pq = () => (process.env.PREVIEW_LINK_QUERY ? `?${process.env.PREVIEW_LINK_QUERY}` : '');
export const acceptUrl = (lang: Lang, token: string) => `${siteUrl()}${localPath(lang, `/klus/${token}`)}${pq()}`;
export const statusUrl = (lang: Lang, token: string) => `${siteUrl()}${localPath(lang, `/hulp/status/${token}`)}${pq()}`;

type Job = { category: string; categoryLabel: string; summary: string; postcode: string; urgency: string | null; createdAt: string };

function rows(lang: Lang, j: Job): [string, string][] {
  return [
    [L(lang, 'Wat', 'What'), j.categoryLabel],
    [L(lang, 'Wanneer', 'When'), urgencyLabel(lang, j.urgency)],
    [L(lang, 'Waar', 'Where'), `${j.postcode.slice(0, 4)} (Uithoorn e.o.)`],
  ];
}

export function jobAlertEmail(lang: Lang, businessName: string, j: Job, token: string, escalation: boolean) {
  const spoed = j.urgency === 'spoed';
  const subject = escalation
    ? L(lang, `SPOED nog niet opgepakt: ${j.categoryLabel} in ${j.postcode.slice(0, 4)} – kun jij nu?`, `URGENT, still open: ${j.categoryLabel} in ${j.postcode.slice(0, 4)} – can you go now?`)
    : `${spoed ? L(lang, '🚨 SPOED: ', '🚨 URGENT: ') : ''}${L(lang, 'Nieuwe klus', 'New job')}: ${j.categoryLabel} (${j.postcode.slice(0, 4)})`;
  return layout(lang, subject, {
    heading: spoed ? L(lang, 'Spoedklus – wie het eerst accepteert, krijgt de klus', 'Urgent job – first to accept gets it') : L(lang, 'Nieuwe klus voor ' + businessName, 'New job for ' + businessName),
    paragraphs: [
      escalation
        ? L(lang, `Deze spoedaanvraag is nog door niemand opgepakt. Je krijgt hem omdat ${businessName} 24/7 spoedhulp aanbiedt.`, `Nobody has picked up this urgent request yet. You get it because ${businessName} offers 24/7 emergency service.`)
        : L(lang, 'Een inwoner zoekt nu hulp. Met één klik neem je de klus aan, inloggen is niet nodig. De eerste die accepteert krijgt de klus en de contactgegevens van de klant.', 'A resident needs help. One click accepts the job, no login needed. The first to accept gets the job and the customer’s contact details.'),
    ],
    quote: j.summary,
    rows: rows(lang, j),
    button: { label: L(lang, 'Bekijk en accepteer de klus', 'View and accept the job'), url: acceptUrl(lang, token) },
    note: L(lang, 'Geen tijd? Dan hoef je niets te doen. Meldingen instellen (sms, WhatsApp, stille uren, 24/7 spoed) doe je in je bedrijfsprofiel.', 'No time? Then do nothing. Set up alerts (SMS, WhatsApp, quiet hours, 24/7 emergency) in your business profile.'),
  });
}

export function jobTakenEmail(lang: Lang, j: Job) {
  return layout(lang, L(lang, `Klus is al vergeven: ${j.categoryLabel} (${j.postcode.slice(0, 4)})`, `Job already taken: ${j.categoryLabel} (${j.postcode.slice(0, 4)})`), {
    heading: L(lang, 'Deze klus is al opgepakt', 'This job has been taken'),
    paragraphs: [L(lang, 'Een ander bedrijf was je net voor. Bedankt voor je snelle reactie, de volgende klus komt eraan.', 'Another business was just ahead of you. Thanks for responding, the next job is on its way.')],
    rows: rows(lang, j),
  });
}

export function jobWonEmail(lang: Lang, businessName: string, j: Job, contact: { name: string; phone: string | null; email: string }, conversationId: string | null, token: string) {
  const r: [string, string][] = [...rows(lang, j), [L(lang, 'Klant', 'Customer'), contact.name || '–'], [L(lang, 'Telefoon', 'Phone'), contact.phone || '–'], ['E-mail', contact.email]];
  return layout(lang, L(lang, `De klus is van jou: ${j.categoryLabel} (${j.postcode.slice(0, 4)})`, `The job is yours: ${j.categoryLabel} (${j.postcode.slice(0, 4)})`), {
    heading: L(lang, `Gelukt, ${businessName}! De klus is van jou`, `Done, ${businessName}! The job is yours`),
    paragraphs: [L(lang, 'Neem zo snel mogelijk contact op met de klant. De klant heeft jouw naam en telefoonnummer ook gekregen.', 'Contact the customer as soon as possible. The customer has also received your name and phone number.')],
    quote: j.summary, rows: r,
    button: { label: L(lang, 'Open de klus', 'Open the job'), url: conversationId ? `${siteUrl()}${localPath(lang, `/messages/${conversationId}`)}` : acceptUrl(lang, token) },
  });
}

export function intakeConfirmationEmail(lang: Lang, j: Job, alerted: number, statusToken: string) {
  const spoed = j.urgency === 'spoed';
  return layout(lang, L(lang, `Je hulpvraag is ontvangen: ${j.categoryLabel}`, `We received your request: ${j.categoryLabel}`), {
    heading: L(lang, 'We zijn ermee bezig', "We're on it"),
    paragraphs: [
      alerted > 0
        ? L(lang, `We hebben ${alerted} lokale ${alerted === 1 ? 'vakman' : 'vakmensen'} direct gewaarschuwd. De eerste die accepteert neemt contact met je op.`, `We alerted ${alerted} local ${alerted === 1 ? 'professional' : 'professionals'} right away. The first to accept will contact you.`)
        : L(lang, 'We zoeken een passend lokaal bedrijf en laten het je weten zodra iemand de klus aanneemt.', "We're finding a matching local business and will tell you as soon as someone takes the job."),
      spoed
        ? L(lang, 'Omdat het spoed is: reageert er binnen 10 minuten niemand, dan benaderen we automatisch bedrijven die 24/7 spoedhulp bieden. Bij direct gevaar: bel 112.', "Because it's urgent: if nobody responds within 10 minutes, we automatically contact businesses that offer 24/7 emergency service. In immediate danger: call 112.")
        : L(lang, 'Je krijgt een e-mail zodra er iemand reageert.', "You'll get an email as soon as someone responds."),
    ],
    quote: j.summary, rows: rows(lang, j),
    button: { label: L(lang, 'Volg je aanvraag live', 'Follow your request live'), url: statusUrl(lang, statusToken) },
  });
}

export function customerAcceptedEmail(lang: Lang, j: Job, biz: { name: string; phone: string | null; website: string | null }, statusToken: string) {
  const r: [string, string][] = [[L(lang, 'Bedrijf', 'Business'), biz.name], [L(lang, 'Telefoon', 'Phone'), biz.phone || '–']];
  if (biz.website) r.push(['Website', biz.website]);
  return layout(lang, L(lang, `${biz.name} neemt je klus aan`, `${biz.name} is taking your job`), {
    heading: L(lang, 'Er komt hulp!', 'Help is on the way!'),
    paragraphs: [L(lang, `${biz.name} heeft je aanvraag "${j.categoryLabel}" aangenomen en neemt zo snel mogelijk contact met je op. Je kunt ook zelf bellen.`, `${biz.name} accepted your request "${j.categoryLabel}" and will contact you as soon as possible. You can also call them yourself.`)],
    rows: r,
    button: { label: L(lang, 'Bekijk je aanvraag', 'View your request'), url: statusUrl(lang, statusToken) },
  });
}

export function customerEscalationEmail(lang: Lang, j: Job, pool: number, statusToken: string, exhausted: boolean) {
  return layout(lang, exhausted ? L(lang, 'Update over je spoedaanvraag', 'Update on your urgent request') : L(lang, 'We schakelen 24/7 spoedhulp in', "We're calling in 24/7 emergency help"), {
    heading: exhausted ? L(lang, 'We zoeken nog naar hulp', "We're still looking for help") : L(lang, 'Nog niemand gereageerd, we gaan verder', 'No response yet, we keep going'),
    paragraphs: [exhausted
      ? L(lang, 'Helaas heeft nog geen bedrijf je spoedaanvraag aangenomen. Ons team is gewaarschuwd en zoekt persoonlijk verder. Bij direct gevaar: bel 112.', "Unfortunately no business has accepted your urgent request yet. Our team has been alerted and is looking personally. In immediate danger: call 112.")
      : L(lang, `Binnen ${process.env.SPOED_ESCALATE_AFTER_MIN || 10} minuten heeft nog niemand gereageerd. We benaderen nu ${pool} ${pool === 1 ? 'bedrijf' : 'bedrijven'} met 24/7 spoedservice.`, `Nobody responded within ${process.env.SPOED_ESCALATE_AFTER_MIN || 10} minutes. We're now contacting ${pool} ${pool === 1 ? 'business' : 'businesses'} with 24/7 emergency service.`)],
    rows: rows(lang, j),
    button: { label: L(lang, 'Volg je aanvraag live', 'Follow your request live'), url: statusUrl(lang, statusToken) },
  });
}
