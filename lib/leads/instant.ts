import 'server-only';
import { queryOne } from '../db';
import { sendEmail } from '../email/send';
import { layout, localPath, newLeadEmail, siteUrl, type Lang } from '../email/templates';
import { getDictionary } from '../i18n/dictionaries';
import { signToken } from '../urgent/tokens';
import { pushToBusiness } from '../push/subscriptions';
import type { MatchedBusiness } from '../data/requests';

// Instant lead alerts for ordinary requests (the /request form and the intake when one-tap job
// alerts are off): the business gets the job details right away by email with a one-tap reply link
// (/aanvraag/<token>, no login needed to accept) and, if it switched them on, a push notification.
// Urgent intake alerts (lib/urgent/alerts.ts) keep their own first-to-accept flow and also push.

const L = (lang: Lang, nl: string, en: string) => (lang === 'en' ? en : nl);
// Previews only (see lib/urgent/mail.ts): lets a tester open alert links on a phone.
const pq = () => (process.env.PREVIEW_LINK_QUERY ? `?${process.env.PREVIEW_LINK_QUERY}` : '');
export const leadUrl = (lang: Lang, token: string) => `${siteUrl()}${localPath(lang, `/aanvraag/${token}`)}${pq()}`;

type Req = { id: string; category: string; description: string; postcode: string; preferred_timing: string | null; urgency: string | null; summary: string | null };

const catLabel = (lang: Lang, cat: string) => (getDictionary(lang).requestForm.categories as Record<string, string>)[cat] ?? cat;
const timingLabel = (lang: Lang, v: string | null) => (v ? ((getDictionary(lang).requestForm.timing as Record<string, string>)[v] ?? v) : '');

export function instantLeadEmail(lang: Lang, businessName: string, r: Req, token: string) {
  const cat = catLabel(lang, r.category);
  const area = r.postcode.slice(0, 4);
  const summary = (r.summary || r.description).replace(/\s+/g, ' ').trim();
  const rows: [string, string][] = [[L(lang, 'Wat', 'What'), cat], [L(lang, 'Waar', 'Where'), `${area} (Uithoorn e.o.)`]];
  const when = timingLabel(lang, r.preferred_timing);
  if (when) rows.push([L(lang, 'Wanneer', 'When'), when]);
  return layout(lang, L(lang, `Nieuwe aanvraag: ${cat} in ${area}`, `New request: ${cat} in ${area}`), {
    heading: L(lang, `Nieuwe aanvraag voor ${businessName}`, `New request for ${businessName}`),
    paragraphs: [L(lang, 'Een inwoner zoekt hulp en jouw bedrijf past erbij. Reageer snel: wie als eerste reageert, krijgt vaak de klus. Met één tik reageer je, inloggen is niet nodig.', 'A resident needs help and your business is a match. Respond fast: the first to respond often wins the job. One tap to respond, no login needed.')],
    quote: summary.length > 500 ? `${summary.slice(0, 500)}…` : summary,
    rows,
    button: { label: L(lang, 'Bekijk en reageer', 'View and respond'), url: leadUrl(lang, token) },
    note: L(lang, 'Geen tijd of past het niet? Dan hoef je niets te doen. Tip: zet in je bedrijfsdashboard meldingen aan, dan zie je nieuwe aanvragen direct op je telefoon.', 'No time or not a fit? Then do nothing. Tip: switch on notifications in your business dashboard to see new requests on your phone instantly.'),
  });
}

/** Email + push to every matched business, right after the request is saved. Never throws. */
export async function sendInstantLeadAlerts(requestId: string, matched: MatchedBusiness[]) {
  let r: Req | null = null;
  try {
    r = await queryOne<Req>(`select id, category, description, postcode, preferred_timing, urgency, intake->>'summary' as summary from service_requests where id = $1`, [requestId])
      .catch(() => queryOne<Req>(`select id, category, description, postcode, preferred_timing, urgency, null::text as summary from service_requests where id = $1`, [requestId]));
  } catch (e) { console.error('[leads] load failed', e instanceof Error ? e.message : e); }
  for (const m of matched) {
    try {
      if (m.locked || !r) {
        // Over the plan limit (pricing on): the old teaser mail, no details.
        await sendEmail({ to: m.ownerEmail, kind: m.locked ? 'lead_locked' : 'new_lead', lang: m.ownerLocale, ...newLeadEmail(m.ownerLocale, m.name, r?.category ?? '', m.locked) });
        continue;
      }
      const token = signToken('lead', [requestId, m.id], 14);
      await sendEmail({ to: m.ownerEmail, kind: 'new_lead', lang: m.ownerLocale, ref: `lead:${requestId}`, ...instantLeadEmail(m.ownerLocale, m.name, r, token) });
      await pushToBusiness(m.id, {
        title: L(m.ownerLocale, `Nieuwe aanvraag: ${catLabel(m.ownerLocale, r.category)}`, `New request: ${catLabel(m.ownerLocale, r.category)}`),
        body: `${r.postcode.slice(0, 4)} · ${(r.summary || r.description).replace(/\s+/g, ' ').slice(0, 110)}`,
        url: `${localPath(m.ownerLocale, `/aanvraag/${token}`)}${pq()}`, tag: `lead-${requestId.slice(0, 8)}`,
      });
    } catch (e) {
      console.error('[leads] alert failed', m.id, e instanceof Error ? e.message : e);
    }
  }
}
