import 'server-only';

// Branded Dutch/English email templates in the site's folk style (cool grey page, white rounded card,
// serif heading, glossy blue button). Every template returns { subject, text, html }.
// All interpolated values are HTML-escaped.

export type Lang = 'nl' | 'en';
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://uithoorn.online').replace(/\/$/, '');
export const siteUrl = site;
export function localPath(lang: Lang, path: string) { return lang === 'en' ? `/en${path === '/' ? '' : path}` : path; }
const L = (lang: Lang, nl: string, en: string) => (lang === 'en' ? en : nl);

function esc(value: string) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export type Mail = { subject: string; text: string; html: string };
type Block = { heading: string; paragraphs: string[]; button?: { label: string; url: string }; note?: string; quote?: string; rows?: [string, string][] };

/** Wraps content in the branded layout. Paragraph strings are plain text (escaped here). */
export function layout(lang: Lang, subject: string, b: Block): Mail {
  const greet = L(lang, 'Groet,\nUithoorn.online', 'Best regards,\nUithoorn.online');
  const textParts = [b.heading, '', ...b.paragraphs.flatMap((p) => [p, ''])];
  if (b.rows?.length) textParts.push(...b.rows.map(([k, v]) => `${k}: ${v}`), '');
  if (b.quote) textParts.push(b.quote.split('\n').map((l) => `> ${l}`).join('\n'), '');
  if (b.button) textParts.push(`${b.button.label}: ${b.button.url}`, '');
  if (b.note) textParts.push(b.note, '');
  textParts.push(greet);
  const text = textParts.join('\n');

  const p = (s: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#2a2b2e">${esc(s).replace(/\n/g, '<br>')}</p>`;
  const rows = b.rows?.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 18px;border-collapse:collapse;font-size:15px">${b.rows.map(([k, v]) => `<tr><td style="padding:8px 0;color:#595a5a;border-bottom:1px solid #eceef2">${esc(k)}</td><td style="padding:8px 0;text-align:right;color:#030003;font-weight:600;border-bottom:1px solid #eceef2">${esc(v)}</td></tr>`).join('')}</table>` : '';
  const quote = b.quote ? `<div style="margin:0 0 18px;padding:14px 16px;border-radius:16px;background:#eef3fe;color:#2a2b2e;font-size:15px;line-height:1.55">${esc(b.quote).replace(/\n/g, '<br>')}</div>` : '';
  const button = b.button ? `<p style="margin:22px 0 8px"><a href="${esc(b.button.url)}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#2f5bd3;background-image:linear-gradient(180deg,#3a68d8,#183d9a);color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 2px 0 #12307c">${esc(b.button.label)}</a></p><p style="margin:0 0 14px;font-size:12px;color:#85858d;word-break:break-all">${esc(b.button.url)}</p>` : '';
  const note = b.note ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#85858d">${esc(b.note)}</p>` : '';
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f6f8">
<div style="display:none;max-height:0;overflow:hidden">${esc(b.paragraphs[0] ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 6px 14px;font-family:Georgia,'Averia Serif Libre',serif;font-size:20px;font-weight:700;color:#030003">uithoorn<span style="color:#3262e8">.online</span></td></tr>
<tr><td style="background:#ffffff;border-radius:24px;padding:28px 26px;box-shadow:0 1px 1.5px rgba(0,0,0,.12),0 18px 40px -24px rgba(20,40,90,.35);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<h1 style="margin:0 0 16px;font-family:Georgia,'Averia Serif Libre',serif;font-size:26px;line-height:1.15;color:#030003;font-weight:700">${esc(b.heading)}</h1>
${b.paragraphs.map(p).join('')}${rows}${quote}${button}${note}
<p style="margin:22px 0 0;font-size:15px;line-height:1.5;color:#2a2b2e">${esc(greet).replace(/\n/g, '<br>')}</p>
</td></tr>
<tr><td style="padding:16px 8px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px;line-height:1.5;color:#85858d;text-align:center">Uithoorn.online · ${esc(L(lang, 'lokale hulp in Uithoorn & De Kwakel', 'local help in Uithoorn & De Kwakel'))} · <a href="${site()}" style="color:#85858d">${site().replace(/^https?:\/\//, '')}</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

export function loginLinkEmail(lang: Lang, url: string) {
  return layout(lang, L(lang, 'Je inloglink voor Uithoorn.online', 'Your sign-in link for Uithoorn.online'), {
    heading: L(lang, 'Inloggen', 'Sign in'),
    paragraphs: [L(lang, 'Klik op de knop om in te loggen. De link werkt één keer en verloopt na 20 minuten.', 'Click the button to sign in. The link works once and expires in 20 minutes.')],
    button: { label: L(lang, 'Inloggen', 'Sign in'), url },
    note: L(lang, 'Niet aangevraagd? Dan kun je deze e-mail negeren.', "Didn't ask for this? You can ignore this email."),
  });
}

export function passwordResetEmail(lang: Lang, url: string, minutes: number) {
  return layout(lang, L(lang, 'Stel een nieuw wachtwoord in', 'Set a new password'), {
    heading: L(lang, 'Nieuw wachtwoord instellen', 'Set a new password'),
    paragraphs: [L(lang, `Je hebt gevraagd om je wachtwoord opnieuw in te stellen. Klik op de knop en kies een nieuw wachtwoord. De link werkt één keer en verloopt na ${minutes} minuten.`, `You asked to reset your password. Click the button and choose a new one. The link works once and expires in ${minutes} minutes.`)],
    button: { label: L(lang, 'Nieuw wachtwoord kiezen', 'Choose a new password'), url },
    note: L(lang, 'Niet aangevraagd? Negeer deze e-mail; je wachtwoord blijft dan hetzelfde.', "Didn't ask for this? Ignore this email and your password stays the same."),
  });
}

export function passwordChangedEmail(lang: Lang) {
  return layout(lang, L(lang, 'Je wachtwoord is gewijzigd', 'Your password was changed'), {
    heading: L(lang, 'Wachtwoord gewijzigd', 'Password changed'),
    paragraphs: [L(lang, 'Het wachtwoord van je Uithoorn.online-account is zojuist gewijzigd. Je bent op andere apparaten uitgelogd.', 'The password of your Uithoorn.online account was just changed. You have been signed out on other devices.')],
    note: L(lang, 'Was jij dit niet? Gebruik dan direct "Wachtwoord vergeten" op de inlogpagina en neem contact met ons op.', 'Not you? Use "Forgot password" on the sign-in page right away and contact us.'),
    button: { label: L(lang, 'Naar inloggen', 'Go to sign in'), url: `${site()}${localPath(lang, '/login')}` },
  });
}

export function welcomeEmail(lang: Lang, name: string, isBusiness: boolean) {
  const dash = `${site()}${localPath(lang, isBusiness ? '/provider' : '/account')}`;
  return layout(lang, L(lang, 'Welkom bij Uithoorn.online', 'Welcome to Uithoorn.online'), {
    heading: L(lang, `Welkom${name ? `, ${name}` : ''}!`, `Welcome${name ? `, ${name}` : ''}!`),
    paragraphs: [
      L(lang, 'Je account is klaar.', 'Your account is ready.'),
      isBusiness
        ? L(lang, 'We controleren elk nieuw bedrijf voordat het in de gids verschijnt. Je hoort snel van ons.', 'We review every new business before it appears in the directory. You will hear from us soon.')
        : L(lang, 'Plaats een hulpvraag en lokale bedrijven uit Uithoorn en De Kwakel reageren.', 'Post a request and local businesses from Uithoorn and De Kwakel will respond.'),
    ],
    button: { label: L(lang, 'Naar je dashboard', 'Go to your dashboard'), url: dash },
  });
}

export function requestConfirmationEmail(lang: Lang, category: string, delivered: number) {
  const url = `${site()}${localPath(lang, '/account')}`;
  return layout(lang, L(lang, `Je hulpvraag is geplaatst: ${category}`, `Your request is posted: ${category}`), {
    heading: L(lang, 'Je hulpvraag is geplaatst', 'Your request is posted'),
    paragraphs: [
      delivered > 0
        ? L(lang, `We hebben je vraag gedeeld met ${delivered} lokale ${delivered === 1 ? 'bedrijf' : 'bedrijven'}. Je krijgt een e-mail zodra er iemand reageert.`, `We shared your request with ${delivered} local ${delivered === 1 ? 'business' : 'businesses'}. You'll get an email as soon as someone responds.`)
        : L(lang, 'We zoeken een passend lokaal bedrijf. Je krijgt een e-mail zodra er iemand reageert.', "We're looking for a matching local business. You'll get an email as soon as someone responds."),
    ],
    rows: [[L(lang, 'Categorie', 'Category'), category]],
    button: { label: L(lang, 'Bekijk je aanvraag', 'View your request'), url },
  });
}

export function newLeadEmail(lang: Lang, businessName: string, category: string, locked: boolean) {
  const dash = `${site()}${localPath(lang, '/provider')}`;
  return layout(lang, L(lang, `Nieuwe aanvraag voor ${businessName}: ${category}`, `New request for ${businessName}: ${category}`), {
    heading: L(lang, 'Nieuwe lead', 'New lead'),
    paragraphs: [locked
      ? L(lang, `Een nieuwe aanvraag voor "${category}" past bij ${businessName}, maar je hebt deze maand alle leads van je pakket gebruikt. Upgrade of koop een losse lead om hem te bekijken.`, `A new request in "${category}" matched ${businessName}, but you have used all leads in your plan this month. Upgrade or buy a single lead to see it.`)
      : L(lang, `Een inwoner zoekt hulp bij "${category}". Bekijk de aanvraag en reageer snel.`, `A resident is looking for help with "${category}". View the request and respond quickly.`)],
    button: { label: L(lang, 'Bekijk de aanvraag', 'View the request'), url: dash },
  });
}

export function requestAcceptedEmail(lang: Lang, businessName: string, conversationId: string) {
  const url = `${site()}${localPath(lang, `/messages/${conversationId}`)}`;
  return layout(lang, L(lang, `${businessName} heeft gereageerd op je aanvraag`, `${businessName} responded to your request`), {
    heading: L(lang, 'Er is gereageerd!', 'Someone responded!'),
    paragraphs: [L(lang, `${businessName} heeft je aanvraag geaccepteerd. Jullie kunnen nu berichten sturen.`, `${businessName} accepted your request. You can now message each other.`)],
    button: { label: L(lang, 'Open het gesprek', 'Open the conversation'), url },
  });
}

export function newMessageEmail(lang: Lang, conversationId: string) {
  const url = `${site()}${localPath(lang, `/messages/${conversationId}`)}`;
  return layout(lang, L(lang, 'Nieuw bericht op Uithoorn.online', 'New message on Uithoorn.online'), {
    heading: L(lang, 'Je hebt een nieuw bericht', 'You have a new message'),
    paragraphs: [L(lang, 'Lees het bericht en reageer in het gesprek.', 'Read the message and reply in the conversation.')],
    button: { label: L(lang, 'Lees en reageer', 'Read and reply'), url },
    note: L(lang, 'We sturen maximaal één e-mail per 15 minuten per gesprek.', 'We send at most one email per 15 minutes per conversation.'),
  });
}

export function businessDecisionEmail(lang: Lang, businessName: string, approved: boolean) {
  const dash = `${site()}${localPath(lang, '/provider')}`;
  if (approved) return layout(lang, L(lang, `${businessName} staat nu op Uithoorn.online`, `${businessName} is now live on Uithoorn.online`), {
    heading: L(lang, 'Goedgekeurd!', 'Approved!'),
    paragraphs: [L(lang, `Goed nieuws: ${businessName} is goedgekeurd en staat nu in de gids. Vanaf nu ontvang je passende hulpvragen.`, `Good news: ${businessName} has been approved and is now listed. From now on you'll receive matching requests.`)],
    button: { label: L(lang, 'Naar je dashboard', 'Go to your dashboard'), url: dash },
  });
  return layout(lang, L(lang, `Over je vermelding van ${businessName}`, `About your listing for ${businessName}`), {
    heading: L(lang, 'Je vermelding', 'Your listing'),
    paragraphs: [L(lang, `We kunnen ${businessName} op dit moment niet goedkeuren. Beantwoord deze e-mail of neem contact op voor meer informatie.`, `We could not approve ${businessName} for now. Reply to this email or contact us for details.`)],
    button: { label: L(lang, 'Contact', 'Contact'), url: `${site()}${localPath(lang, '/contact')}` },
  });
}

export function paymentReceiptEmail(lang: Lang, p: { businessName: string; amount: string; description: string; method: string; paidOn: string; reference: string }) {
  return layout(lang, L(lang, `Betaalbewijs Uithoorn.online – ${p.businessName}`, `Payment receipt Uithoorn.online – ${p.businessName}`), {
    heading: L(lang, 'Bedankt voor je betaling', 'Thank you for your payment'),
    paragraphs: [L(lang, `We hebben je betaling voor ${p.businessName} ontvangen en verwerkt.`, `We have received and processed your payment for ${p.businessName}.`)],
    rows: [[L(lang, 'Omschrijving', 'Description'), p.description], [L(lang, 'Bedrag', 'Amount'), p.amount], [L(lang, 'Betaald via', 'Paid via'), p.method], [L(lang, 'Datum', 'Date'), p.paidOn], [L(lang, 'Referentie', 'Reference'), p.reference]],
    button: { label: L(lang, 'Naar je dashboard', 'Go to your dashboard'), url: `${site()}${localPath(lang, '/provider')}` },
    note: L(lang, 'Dit is een betaalbevestiging, geen factuur.', 'This is a payment confirmation, not an invoice.'),
  });
}

export function contactAutoReplyEmail(lang: Lang, name: string, message: string) {
  return layout(lang, L(lang, 'We hebben je bericht ontvangen', 'We received your message'), {
    heading: L(lang, `Bedankt${name ? `, ${name}` : ''}!`, `Thanks${name ? `, ${name}` : ''}!`),
    paragraphs: [L(lang, 'We hebben je bericht ontvangen en reageren meestal binnen één werkdag.', 'We received your message and usually reply within one working day.')],
    quote: message.slice(0, 1500),
  });
}

export function adminReplyEmail(lang: Lang, subject: string, body: string) {
  return layout(lang, subject, { heading: subject, paragraphs: body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean) });
}

/** Admin alerts (always Dutch; they go to the owner). */
export function adminAlertEmail(title: string, summary: string, rows: [string, string][], link: string) {
  return layout('nl', `[Uithoorn.online] ${title}: ${summary}`.slice(0, 200), {
    heading: title, paragraphs: [summary], rows, button: { label: 'Open in admin', url: link },
  });
}

export function inboundForwardEmail(from: string, to: string, subject: string, text: string, link: string) {
  return layout('nl', `[Inbox] ${subject || '(geen onderwerp)'} — van ${from}`.slice(0, 200), {
    heading: 'Nieuwe e-mail ontvangen',
    paragraphs: [`Van: ${from}`, `Aan: ${to}`, `Onderwerp: ${subject || '(geen onderwerp)'}`],
    quote: text.slice(0, 8000) || '(leeg bericht)',
    button: { label: 'Beantwoord in admin', url: link },
    note: 'Beantwoorden kan ook direct: "Antwoorden" in je mailprogramma gaat naar de afzender.',
  });
}
