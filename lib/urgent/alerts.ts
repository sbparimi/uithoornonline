import 'server-only';
import type { PoolClient } from 'pg';
import { query, queryOne, transaction } from '../db';
import { createRequest, MATCH_SQL } from '../data/requests';
import type { SessionUser } from '../auth/session';
import { notificationText } from '../notification-text';
import { sendEmailDetailed } from '../email/send';
import { getDictionary } from '../i18n/dictionaries';
import { notify } from '../notify';
import type { Lang } from '../email/templates';
import { signToken } from './tokens';
import { callGapMinutes, emailAlertsEnabled, escalateAfterMinutes, escalationEnabled, voiceAlertsEnabled } from './flags';
import { placeCall, sendSms, sendWhatsApp, type ChannelResult } from './channels';
import { customerAcceptedEmail, customerEscalationEmail, intakeConfirmationEmail, jobAlertEmail, jobTakenEmail, jobWonEmail, urgencyLabel } from './mail';
import type { UrgencyLevel } from './llm';

// 24/7 urgent handling: intake request creation, instant multi-channel job alerts with a signed
// one-tap accept link (first to accept wins), and the spoed escalation state machine that the
// scheduler (app/api/cron/urgent + live status page polling) advances. docs/URGENT_HANDLING.md.

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://uithoorn.online').replace(/\/$/, '');
export const categoryLabel = (lang: Lang, cat: string) => (getDictionary(lang).requestForm.categories as Record<string, string>)[cat] ?? cat;

export const LEVEL_TO_FIELDS: Record<UrgencyLevel, { preferredTiming: string; urgency: string }> = {
  spoed: { preferredTiming: 'Today', urgency: 'As soon as possible' },
  today: { preferredTiming: 'Today', urgency: 'As soon as possible' },
  week: { preferredTiming: 'This week', urgency: 'Within a week' },
  flexible: { preferredTiming: 'Flexible', urgency: 'No urgency' },
};

export type IntakeInput = {
  category: string; description: string; postcode: string; level: UrgencyLevel; name: string; email: string; phone: string | null;
  lang: Lang; intake: Record<string, unknown>; photos: { mime: string; data: Buffer }[];
};

/** Logged-in user, else the existing account for this email, else a new customer account (no password; sign in by email link). */
async function customerFor(current: SessionUser | null, input: IntakeInput): Promise<{ id: string; email: string; locale: Lang }> {
  if (current) return { id: current.id, email: current.email, locale: input.lang };
  const created = await queryOne<{ id: string; email: string; locale: Lang }>(
    `insert into users(email, full_name, phone, role, locale, terms_accepted_at) values ($1, $2, $3, 'customer', $4, now())
     on conflict (email) do nothing returning id, email, locale`, [input.email, input.name.slice(0, 120), input.phone, input.lang]);
  if (created) return created;
  const existing = await queryOne<{ id: string; email: string; locale: Lang; disabled_at: string | null }>('select id, email, locale, disabled_at from users where email = $1', [input.email]);
  if (!existing || existing.disabled_at) throw new Error('account_unavailable');
  return existing;
}

export async function createIntakeRequest(current: SessionUser | null, input: IntakeInput) {
  const customer = await customerFor(current, input);
  const f = LEVEL_TO_FIELDS[input.level];
  const result = await createRequest({ id: customer.id } as SessionUser, {
    category: input.category, description: input.description, postcode: input.postcode, preferredTiming: f.preferredTiming, urgency: f.urgency, budgetMin: null, budgetMax: null,
  });
  await transaction(async (c) => {
    await c.query(
      `update service_requests set urgency_level = $2, source = 'intake', contact_name = $3, contact_phone = $4, contact_email = $5, intake = $6 where id = $1`,
      [result.id, input.level, input.name.slice(0, 120), input.phone, input.email, JSON.stringify(input.intake)]);
    for (const p of input.photos.slice(0, 3)) await c.query('insert into request_photos(request_id, mime, data) values ($1, $2, $3)', [result.id, p.mime, p.data]);
  });
  return { id: result.id, customer, matched: result.matched, delivered: result.delivered };
}

type ReqRow = {
  id: string; category: string; description: string; postcode: string; urgency_level: UrgencyLevel | null; created_at: string; status: string; hidden: boolean;
  customer_id: string; customer_email: string; customer_locale: Lang; customer_name: string; customer_phone: string | null;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null; intake: { summary?: string } | null;
  accepted_business_id: string | null; accepted_at: string | null; escalation_stage: string; escalation_index: number;
};

export async function loadRequest(id: string, client?: PoolClient): Promise<ReqRow | null> {
  const sql = `select r.id, r.category, r.description, r.postcode, r.urgency_level, r.created_at, r.status, r.hidden, r.customer_id,
                      u.email as customer_email, u.locale as customer_locale, u.full_name as customer_name, u.phone as customer_phone,
                      r.contact_name, r.contact_phone, r.contact_email, r.intake, r.accepted_business_id, r.accepted_at, r.escalation_stage, r.escalation_index
                 from service_requests r join users u on u.id = r.customer_id where r.id = $1`;
  if (client) return (await client.query<ReqRow>(sql, [id])).rows[0] ?? null;
  return queryOne<ReqRow>(sql, [id]);
}

const job = (lang: Lang, r: ReqRow) => ({
  category: r.category, categoryLabel: categoryLabel(lang, r.category), summary: (r.intake?.summary || r.description).slice(0, 600),
  postcode: r.postcode, urgency: r.urgency_level, createdAt: r.created_at,
});
const contactOf = (r: ReqRow) => ({ name: r.contact_name || r.customer_name, phone: r.contact_phone || r.customer_phone, email: r.contact_email || r.customer_email });

type Biz = { id: string; name: string; owner_email: string; owner_locale: Lang; phone: string | null; website: string | null; alert_email: boolean; alert_sms: boolean; alert_whatsapp: boolean; alert_phone: string | null; spoed_24_7: boolean; quiet_start: string | null; quiet_end: string | null };
const BIZ_COLS = `b.id, b.name, u.email as owner_email, u.locale as owner_locale, b.phone, b.website, b.alert_email, b.alert_sms, b.alert_whatsapp, b.alert_phone, b.spoed_24_7, b.quiet_start::text, b.quiet_end::text`;

async function logAlert(requestId: string, businessId: string | null, audience: 'business' | 'customer' | 'admin', channel: 'email' | 'sms' | 'whatsapp' | 'voice', stage: string, r: { status: string; id: string | null; error: string | null; to: string | null }) {
  await query(`insert into job_alerts(request_id, business_id, audience, channel, stage, status, recipient, provider_id, error) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [requestId, businessId, audience, channel, stage, r.status === 'skipped' ? 'skipped' : r.status, r.to?.slice(0, 254) ?? null, r.id?.slice(0, 200) ?? null, r.error?.slice(0, 500) ?? null]).catch((e) => console.error('[alerts] log failed', e?.message));
}

async function email(requestId: string, businessId: string | null, audience: 'business' | 'customer', stage: string, to: string, kind: string, lang: Lang, mail: { subject: string; text: string; html: string }) {
  const res = await sendEmailDetailed({ to, kind, lang, ref: `urgent:${requestId}`, ...mail });
  await logAlert(requestId, businessId, audience, 'email', stage, { status: res.status, id: res.id, error: res.error, to });
  return res;
}

/** Amsterdam wall-clock "HH:MM" now. */
function amsterdamHm() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}
export function inQuietHours(b: Pick<Biz, 'quiet_start' | 'quiet_end'>, now = amsterdamHm()) {
  if (!b.quiet_start || !b.quiet_end) return false;
  const s = b.quiet_start.slice(0, 5); const e = b.quiet_end.slice(0, 5);
  if (s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e; // overnight window, e.g. 22:00–07:00
}

function smsText(lang: Lang, r: ReqRow, token: string, escalation: boolean) {
  const j = job(lang, r);
  const head = r.urgency_level === 'spoed' ? (lang === 'en' ? 'URGENT job' : 'SPOEDKLUS') : (lang === 'en' ? 'New job' : 'Nieuwe klus');
  const tail = lang === 'en' ? 'First to accept gets it:' : 'Wie het eerst accepteert, krijgt de klus:';
  return `${escalation ? (lang === 'en' ? 'Still open! ' : 'Nog open! ') : ''}${head} via Uithoorn.online: ${j.categoryLabel}, ${j.postcode.slice(0, 4)}. "${j.summary.slice(0, 120)}" ${tail} ${site()}${lang === 'en' ? '/en' : ''}/klus/${token}`;
}

/** Sends one business every channel it allows for this stage. */
async function alertBusiness(r: ReqRow, b: Biz, stage: 'initial' | 'escalation') {
  const lang: Lang = b.owner_locale === 'en' ? 'en' : 'nl';
  const token = signToken('accept', [r.id, b.id], 3);
  const out: Record<string, string> = {};
  if (b.alert_email || stage === 'escalation') {
    const res = await email(r.id, b.id, 'business', stage, b.owner_email, 'job_alert', lang, jobAlertEmail(lang, b.name, job(lang, r), token, stage === 'escalation'));
    out.email = res.status;
  }
  // SMS/WhatsApp: the business opted in; quiet hours hold them back, except escalation to a 24/7 business.
  const quiet = inQuietHours(b) && !(stage === 'escalation' && b.spoed_24_7);
  const mobile = b.alert_phone || b.phone;
  const text = smsText(lang, r, token, stage === 'escalation');
  for (const [channel, wanted, send] of [['sms', b.alert_sms || (stage === 'escalation' && b.spoed_24_7), sendSms], ['whatsapp', b.alert_whatsapp, sendWhatsApp]] as const) {
    if (!wanted) continue;
    const res: ChannelResult = quiet ? { status: 'skipped', id: null, error: 'quiet hours', to: mobile } : await send(mobile, text);
    await logAlert(r.id, b.id, 'business', channel, stage, res);
    out[channel] = res.status;
  }
  return out;
}

/** Initial alerts to every business the matcher picked (leads), right after the request is created. */
export async function dispatchInitialAlerts(requestId: string) {
  const r = await loadRequest(requestId);
  if (!r) return { alerted: 0 };
  const businesses = await query<Biz>(
    `select ${BIZ_COLS} from leads l join businesses b on b.id = l.business_id join users u on u.id = b.owner_id
      where l.request_id = $1 and l.status <> 'locked' and b.active and b.moderation_status = 'approved' and u.disabled_at is null`, [requestId]);
  let alerted = 0;
  for (const b of businesses) {
    const res = await alertBusiness(r, b, 'initial');
    if (Object.values(res).includes('sent') || Object.values(res).includes('skipped')) alerted++;
  }
  // Spoed: start the escalation clock (immediately when nobody matched at all).
  const spoed = r.urgency_level === 'spoed' && escalationEnabled();
  await query(`update service_requests set alerts_sent_at = now(), escalation_stage = $2, escalation_next_at = $3 where id = $1`,
    [requestId, spoed ? 'waiting' : 'none', spoed ? new Date(Date.now() + (businesses.length ? escalateAfterMinutes() * 60_000 : 0)) : null]);
  return { alerted: businesses.length, sent: alerted };
}

export async function sendIntakeConfirmation(requestId: string, alerted: number) {
  const r = await loadRequest(requestId);
  if (!r) return;
  const lang = r.customer_locale === 'en' ? 'en' : 'nl';
  const token = signToken('status', [r.id], 30);
  const c = contactOf(r);
  await email(r.id, null, 'customer', 'update', c.email, 'intake_confirmation', lang, intakeConfirmationEmail(lang, job(lang, r), alerted, token));
}

async function customerUpdate(r: ReqRow, stage: string, mail: { subject: string; text: string; html: string }, sms: string) {
  const lang = r.customer_locale === 'en' ? 'en' : 'nl';
  const c = contactOf(r);
  await email(r.id, null, 'customer', stage, c.email, `urgent_${stage}`, lang, mail);
  if (c.phone) await logAlert(r.id, null, 'customer', 'sms', stage, await sendSms(c.phone, sms));
}

export type AcceptResult =
  | { ok: true; already: boolean; businessName: string; conversationId: string | null; contact: { name: string; phone: string | null; email: string } }
  | { ok: false; error: 'not_found' | 'taken' | 'closed' | 'business_unavailable' };

/** First business to accept wins. Idempotent for the winner. */
export async function acceptJob(requestId: string, businessId: string, via: 'link' | 'voice' | 'dashboard'): Promise<AcceptResult> {
  const biz = await queryOne<Biz & { owner_id: string; active: boolean; moderation_status: string }>(
    `select ${BIZ_COLS}, b.owner_id, b.active, b.moderation_status from businesses b join users u on u.id = b.owner_id where b.id = $1`, [businessId]);
  if (!biz || !biz.active || biz.moderation_status !== 'approved') return { ok: false, error: 'business_unavailable' };
  const outcome = await transaction(async (c) => {
    const won = await c.query<{ id: string }>(
      `update service_requests set accepted_business_id = $2, accepted_at = now(), accepted_via = $3, escalation_stage = case when escalation_stage = 'none' then 'none' else 'done' end, escalation_next_at = null
        where id = $1 and accepted_business_id is null and hidden = false and status not in ('completed', 'cancelled', 'expired') returning id`, [requestId, businessId, via]);
    const r = await loadRequest(requestId, c);
    if (!r) return { error: 'not_found' as const };
    if (!won.rowCount) {
      if (r.accepted_business_id === businessId) {
        const conv = await c.query<{ id: string }>('select id from conversations where request_id = $1 and business_id = $2', [requestId, businessId]);
        return { r, already: true, conversationId: conv.rows[0]?.id ?? null };
      }
      return { error: r.accepted_business_id ? 'taken' as const : 'closed' as const };
    }
    // Same bookkeeping as a dashboard accept (lib/data/conversations.ts acceptRequest), plus a lead
    // for escalation businesses the matcher had not picked.
    await c.query('insert into request_providers(request_id, business_id, status, responded_at) values ($1, $2, \'accepted\', now()) on conflict (request_id, business_id) do update set status = \'accepted\', responded_at = now()', [requestId, businessId]);
    await c.query(`insert into leads(request_id, business_id, status, accepted_at) values ($1, $2, 'accepted', now())
                   on conflict (request_id, business_id) do update set status = 'accepted', accepted_at = now(), updated_at = now()`, [requestId, businessId]);
    await c.query(`update leads set status = 'closed', updated_at = now() where request_id = $1 and business_id <> $2 and status in ('new', 'viewed', 'locked')`, [requestId, businessId]);
    const { rows: [conv] } = await c.query<{ id: string }>(
      `insert into conversations(request_id, customer_id, business_id, status) values ($1, $2, $3, 'active')
       on conflict (request_id, business_id) do update set status = 'active', updated_at = now() returning id`, [requestId, r.customer_id, businessId]);
    await c.query(`update service_requests set status = 'in_conversation' where id = $1`, [requestId]);
    const acc = notificationText('accepted', r.customer_locale);
    await c.query(`insert into notifications(user_id, type, title, body, conversation_id, request_id) values ($1, 'request_update', $4, $5, $2, $3)`, [r.customer_id, conv.id, requestId, acc.title, acc.body]);
    return { r, already: false, conversationId: conv.id };
  });
  if ('error' in outcome) return { ok: false, error: outcome.error! };
  const { r, already, conversationId } = outcome;
  if (!already) {
    // Customer: who is coming. Winner: the customer's details. Everyone else alerted: it's taken.
    const lang: Lang = r.customer_locale === 'en' ? 'en' : 'nl';
    const statusToken = signToken('status', [r.id], 30);
    await customerUpdate(r, 'accepted', customerAcceptedEmail(lang, job(lang, r), { name: biz.name, phone: biz.phone, website: biz.website }, statusToken),
      lang === 'en' ? `Uithoorn.online: ${biz.name} accepted your request and will contact you. Phone: ${biz.phone || '-'}` : `Uithoorn.online: ${biz.name} neemt je klus aan en neemt contact op. Tel: ${biz.phone || '-'}`);
    const bl: Lang = biz.owner_locale === 'en' ? 'en' : 'nl';
    await email(r.id, biz.id, 'business', 'accepted', biz.owner_email, 'job_won', bl, jobWonEmail(bl, biz.name, job(bl, r), contactOf(r), conversationId, signToken('accept', [r.id, biz.id], 3)));
    const others = await query<{ business_id: string; owner_email: string; owner_locale: Lang }>(
      `select distinct a.business_id, u.email as owner_email, u.locale as owner_locale from job_alerts a join businesses b on b.id = a.business_id join users u on u.id = b.owner_id
        where a.request_id = $1 and a.audience = 'business' and a.business_id <> $2 and a.status = 'sent'`, [r.id, biz.id]);
    for (const o of others) {
      const ol: Lang = o.owner_locale === 'en' ? 'en' : 'nl';
      await email(r.id, o.business_id, 'business', 'taken', o.owner_email, 'job_taken', ol, jobTakenEmail(ol, job(ol, r)));
    }
  }
  return { ok: true, already, businessName: biz.name, conversationId, contact: contactOf(r) };
}

/** 24/7 businesses that fit this request (matcher's own category logic), matched ones first. */
async function spoedPool(r: ReqRow) {
  const postcode4 = r.postcode.replace(/\D/g, '').slice(0, 4);
  return query<Biz>(
    `with m as (${MATCH_SQL}) select ${BIZ_COLS} from m join businesses b on b.id = m.id join users u on u.id = b.owner_id
      where b.spoed_24_7 = true order by (exists (select 1 from leads l where l.request_id = $4 and l.business_id = b.id)) desc, b.featured desc, b.created_at`,
    [r.category.toLowerCase().replace(/[\\%_]/g, '\\$&'), postcode4, r.customer_id, r.id]);
}

async function exhaust(r: ReqRow, pool: number) {
  await query(`update service_requests set escalation_stage = 'exhausted', escalation_next_at = null where id = $1 and accepted_business_id is null`, [r.id]);
  const lang: Lang = r.customer_locale === 'en' ? 'en' : 'nl';
  await customerUpdate(r, 'update', customerEscalationEmail(lang, job(lang, r), pool, signToken('status', [r.id], 30), true),
    lang === 'en' ? 'Uithoorn.online: no business has accepted your urgent request yet. Our team is looking personally. In danger call 112.' : 'Uithoorn.online: nog geen bedrijf heeft je spoedaanvraag aangenomen. Ons team zoekt persoonlijk verder. Bij gevaar: bel 112.');
  await notify('spoed_unhandled', `${categoryLabel('nl', r.category)} (${r.postcode}) – niemand heeft geaccepteerd`, { requestId: r.id, gebeld: pool, klant: contactOf(r).name, telefoon: contactOf(r).phone ?? '' });
}

/** One escalation step for a due spoed request. */
async function step(id: string) {
  const r = await loadRequest(id);
  if (!r || r.accepted_business_id || r.hidden || ['completed', 'cancelled', 'expired'].includes(r.status)) {
    await query(`update service_requests set escalation_next_at = null where id = $1`, [id]);
    return 'closed';
  }
  const pool = await spoedPool(r);
  const lang: Lang = r.customer_locale === 'en' ? 'en' : 'nl';
  if (r.escalation_stage === 'waiting') {
    if (!pool.length) { await exhaust(r, 0); return 'exhausted:no_24_7'; }
    for (const b of pool) await alertBusiness(r, b, 'escalation');
    await customerUpdate(r, 'update', customerEscalationEmail(lang, job(lang, r), pool.length, signToken('status', [r.id], 30), false),
      lang === 'en' ? `Uithoorn.online: nobody responded yet, we're now contacting ${pool.length} business(es) with 24/7 emergency service.` : `Uithoorn.online: nog niemand gereageerd, we benaderen nu ${pool.length} bedrijf/bedrijven met 24/7 spoedservice.`);
    const calling = voiceAlertsEnabled();
    await query(`update service_requests set escalation_stage = $2, escalation_index = 0, escalation_next_at = now() + make_interval(mins => $3) where id = $1`,
      [id, calling ? 'calling' : 'escalated', calling ? 1 : 20]);
    return calling ? 'escalated:calling_next' : 'escalated';
  }
  if (r.escalation_stage === 'calling' && r.escalation_index < pool.length) {
    const b = pool[r.escalation_index];
    const bl: Lang = b.owner_locale === 'en' ? 'en' : 'nl';
    const voiceToken = signToken('voice', [r.id, b.id], 1);
    const say = `Dit is Uithoorn punt online met een spoedklus: ${categoryLabel('nl', r.category)} in postcode ${r.postcode.slice(0, 4)}. Druk op 1 om de klus aan te nemen.`;
    const res = await placeCall(b.alert_phone || b.phone, say, `${site()}/api/alerts/voice?t=${encodeURIComponent(voiceToken)}`);
    await logAlert(r.id, b.id, 'business', 'voice', 'call', res);
    void bl;
    await query(`update service_requests set escalation_index = escalation_index + 1, escalation_next_at = now() + make_interval(mins => $2) where id = $1`, [id, callGapMinutes()]);
    return `called:${r.escalation_index + 1}/${pool.length}`;
  }
  await exhaust(r, pool.length);
  return 'exhausted';
}

/** Advances every due spoed escalation. Safe to call often and concurrently (rows are claimed). */
export async function runDueEscalations(limit = 5) {
  if (!escalationEnabled()) return { ran: 0, results: [] as string[] };
  const claimed = await query<{ id: string }>(
    `update service_requests set escalation_next_at = now() + interval '2 minutes'
      where id in (select id from service_requests where escalation_next_at <= now() and accepted_business_id is null
                    order by escalation_next_at limit $1 for update skip locked)
      returning id`, [limit]);
  const results: string[] = [];
  for (const { id } of claimed) {
    try { results.push(`${id.slice(0, 8)}:${await step(id)}`); }
    catch (e) { console.error('[urgent] step failed', id, e instanceof Error ? e.message : e); results.push(`${id.slice(0, 8)}:error`); }
  }
  return { ran: claimed.length, results };
}

/** Cheap opportunistic tick (status page polls, accept page): never throws. */
export async function tickQuietly() {
  try { await runDueEscalations(3); } catch (e) { console.error('[urgent] tick failed', e instanceof Error ? e.message : e); }
}

export async function requestStatus(requestId: string) {
  const r = await queryOne<{ id: string; category: string; urgency_level: string | null; postcode: string; created_at: string; status: string; escalation_stage: string; accepted_at: string | null; alerts_sent_at: string | null;
    biz_name: string | null; biz_phone: string | null; biz_website: string | null; alerted: number; escalated: number; customer_locale: string; summary: string | null }>(
    `select r.id, r.category, r.urgency_level, r.postcode, r.created_at, r.status, r.escalation_stage, r.accepted_at, r.alerts_sent_at,
            b.name as biz_name, b.phone as biz_phone, b.website as biz_website, u.locale as customer_locale, coalesce(r.intake->>'summary', r.description) as summary,
            (select count(distinct business_id)::int from job_alerts a where a.request_id = r.id and a.audience = 'business' and a.stage = 'initial') as alerted,
            (select count(distinct business_id)::int from job_alerts a where a.request_id = r.id and a.audience = 'business' and a.stage in ('escalation', 'call')) as escalated
       from service_requests r join users u on u.id = r.customer_id left join businesses b on b.id = r.accepted_business_id where r.id = $1`, [requestId]);
  return r;
}

export { urgencyLabel, emailAlertsEnabled };
