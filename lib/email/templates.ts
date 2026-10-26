import 'server-only';

export type Lang = 'nl' | 'en';
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://uithoorn.online').replace(/\/$/, '');
export const siteUrl = site;
export function localPath(lang: Lang, path: string) { return lang === 'en' ? `/en${path === '/' ? '' : path}` : path; }

const sign = { nl: '\n\nGroet,\nUithoorn.online', en: '\n\nBest regards,\nUithoorn.online' };

export function loginLinkEmail(lang: Lang, url: string) {
  return lang === 'en'
    ? { subject: 'Your sign-in link for Uithoorn.online', text: `Click the link below to sign in. It works once and expires in 20 minutes.\n\n${url}\n\nDidn't ask for this? You can ignore this email.${sign.en}` }
    : { subject: 'Je inloglink voor Uithoorn.online', text: `Klik op de link hieronder om in te loggen. De link werkt één keer en verloopt na 20 minuten.\n\n${url}\n\nNiet aangevraagd? Dan kun je deze e-mail negeren.${sign.nl}` };
}

export function welcomeEmail(lang: Lang, name: string, isBusiness: boolean) {
  const dash = `${site()}${localPath(lang, isBusiness ? '/provider' : '/account')}`;
  if (lang === 'en') {
    return { subject: 'Welcome to Uithoorn.online', text: `Hi ${name || 'there'},\n\nYour account is ready.${isBusiness ? ' We review every new business before it appears in the directory; you will hear from us soon.' : ''}\n\nYour dashboard: ${dash}${sign.en}` };
  }
  return { subject: 'Welkom bij Uithoorn.online', text: `Hoi ${name || ''},\n\nJe account is klaar.${isBusiness ? ' We controleren elk nieuw bedrijf voordat het in de gids verschijnt; je hoort snel van ons.' : ''}\n\nJe dashboard: ${dash}${sign.nl}` };
}

export function newLeadEmail(lang: Lang, businessName: string, category: string, locked: boolean) {
  const dash = `${site()}${localPath(lang, '/provider')}`;
  if (lang === 'en') {
    return { subject: `New request for ${businessName}: ${category}`, text: locked
      ? `A new request in "${category}" matched ${businessName}, but you have used all leads in your plan this month. Upgrade to see it: ${dash}${sign.en}`
      : `A resident is looking for help with "${category}". View the request and respond: ${dash}${sign.en}` };
  }
  return { subject: `Nieuwe aanvraag voor ${businessName}: ${category}`, text: locked
    ? `Een nieuwe aanvraag voor "${category}" past bij ${businessName}, maar je hebt deze maand alle leads van je pakket gebruikt. Upgrade om hem te bekijken: ${dash}${sign.nl}`
    : `Een inwoner zoekt hulp bij "${category}". Bekijk de aanvraag en reageer: ${dash}${sign.nl}` };
}

export function requestAcceptedEmail(lang: Lang, businessName: string, conversationId: string) {
  const url = `${site()}${localPath(lang, `/messages/${conversationId}`)}`;
  return lang === 'en'
    ? { subject: `${businessName} responded to your request`, text: `${businessName} accepted your request. You can now message each other: ${url}${sign.en}` }
    : { subject: `${businessName} heeft gereageerd op je aanvraag`, text: `${businessName} heeft je aanvraag geaccepteerd. Jullie kunnen nu berichten sturen: ${url}${sign.nl}` };
}

export function newMessageEmail(lang: Lang, conversationId: string) {
  const url = `${site()}${localPath(lang, `/messages/${conversationId}`)}`;
  return lang === 'en'
    ? { subject: 'New message on Uithoorn.online', text: `You have a new message. Read and reply: ${url}${sign.en}` }
    : { subject: 'Nieuw bericht op Uithoorn.online', text: `Je hebt een nieuw bericht. Lees en reageer: ${url}${sign.nl}` };
}

export function businessDecisionEmail(lang: Lang, businessName: string, approved: boolean) {
  const dash = `${site()}${localPath(lang, '/provider')}`;
  if (lang === 'en') return approved
    ? { subject: `${businessName} is now live on Uithoorn.online`, text: `Good news: ${businessName} has been approved and is now listed. Your dashboard: ${dash}${sign.en}` }
    : { subject: `About your listing for ${businessName}`, text: `We could not approve ${businessName} for now. Reply to this email or contact us via ${site()}/en/contact for details.${sign.en}` };
  return approved
    ? { subject: `${businessName} staat nu op Uithoorn.online`, text: `Goed nieuws: ${businessName} is goedgekeurd en staat nu in de gids. Je dashboard: ${dash}${sign.nl}` }
    : { subject: `Over je vermelding van ${businessName}`, text: `We kunnen ${businessName} op dit moment niet goedkeuren. Neem contact op via ${site()}/contact voor meer informatie.${sign.nl}` };
}
