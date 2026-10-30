import 'server-only';
import { query, queryOne, transaction } from '../db';
import { MATCH_SQL, matchParams } from '../matching';
import { notificationText } from '../notification-text';
import { notify } from '../notify';
import type { Lang } from '../email/templates';
import { acceptJob, BIZ_COLS, categoryLabel, contactOf, email, job, loadRequest, logAlert, type Biz, type ReqRow } from './alerts';
import { jobBrief, rulesBrief, type Answer, type JobBrief } from './ai-request';
import { QUOTE_BATCH, QUOTE_MAX_ROUNDS, quoteRoundHours, quotesEnabled } from './flags';
import { sendSms } from './channels';
import { newQuoteEmail, nextRoundEmail, noQuotesEmail, quoteConfirmationEmail, quoteRequestEmail, reviewRequestEmail } from './quote-mail';
import { signToken } from './tokens';
import { acceptUrl } from './mail';

// AI request flow for all jobs (docs/AI_REQUESTS.md). Non-urgent help-assistant requests go to the best
// 3 businesses (lib/matching.ts), each with an AI job brief. Businesses answer with a quote from the
// one-tap job page (no login); the customer compares quotes on the status page and picks one, which
// reuses acceptJob() (winner gets the contact details, others are told). No quote within
// QUOTE_ROUND_HOURS (24) → the next 3 businesses (runDueRounds, idempotent, cron + page views).
// After the job is marked done (customer or business) the customer gets a verified review request.

type QuoteReq = ReqRow & { quote_mode: boolean; ai_brief: Record<string, JobBrief> | null; match_round: number; completed_at: string | null; review_requested_at: string | null };

async function loadQuoteRequest(id: string) {
  const base = await loadRequest(id);
  if (!base) return null;
  const extra = await queryOne<{ quote_mode: boolean; ai_brief: Record<string, JobBrief> | null; match_round: number; completed_at: string | null; review_requested_at: string | null }>(
    'select quote_mode, ai_brief, match_round, completed_at, review_requested_at from service_requests where id = $1', [id]);
  return { ...base, ...extra } as QuoteReq;
}

const answersOf = (r: { intake: unknown }): Answer[] => {
  const a = (r.intake as { answers?: unknown } | null)?.answers;
  return Array.isArray(a) ? (a as Answer[]).filter((x) => x && typeof x.q === 'string' && typeof x.a === 'string') : [];
};
const photosOf = (r: { intake: unknown }) => Number((r.intake as { photos?: unknown } | null)?.photos ?? 0) || 0;
const problemOf = (r: ReqRow) => r.description.split('\n\n')[0] || r.description;

/** The AI job brief in this language, generated once and stored (labelled AI; editable by nobody but shown as a suggestion). */
export async function briefFor(r: QuoteReq, lang: Lang): Promise<JobBrief> {
  const cached = r.ai_brief?.[lang];
  if (cached?.summary) return cached;
  const input = { category: r.category, categoryLabel: categoryLabel(lang, r.category), description: problemOf(r), answers: answersOf(r), postcode: r.postcode, level: r.urgency_level ?? 'flexible', photos: photosOf(r), lang };
  let brief: JobBrief;
  try { brief = await jobBrief(input); } catch { brief = rulesBrief(input); }
  await query(`update service_requests set ai_brief = coalesce(ai_brief, '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb) where id = $1`, [r.id, lang, JSON.stringify(brief)]);
  r.ai_brief = { ...(r.ai_brief ?? {}), [lang]: brief };
  return brief;
}

async function sendQuoteRequest(r: QuoteReq, b: Biz, round: number) {
  const lang: Lang = b.owner_locale === 'en' ? 'en' : 'nl';
  const brief = await briefFor(r, lang);
  const token = signToken('accept', [r.id, b.id], 14);
  const res = await email(r.id, b.id, 'business', 'initial', b.owner_email, 'quote_request', lang, quoteRequestEmail(lang, b.name, job(lang, r), brief, answersOf(r), token, round));
  if (b.alert_sms) {
    const text = lang === 'en' ? `Quote request via Uithoorn.online: ${categoryLabel(lang, r.category)}, ${r.postcode.slice(0, 4)}. Send a quote: ` : `Offerteaanvraag via Uithoorn.online: ${categoryLabel(lang, r.category)}, ${r.postcode.slice(0, 4)}. Stuur een offerte: `;
    await logAlert(r.id, b.id, 'business', 'sms', 'initial', await sendSms(b.alert_phone || b.phone, text + acceptUrl(lang, token)));
  }
  return res.status;
}

/** Round 1: brief + quote requests to the businesses createRequest picked (best 3), customer confirmation, 24 h clock. */
export async function dispatchQuoteRequest(requestId: string) {
  const r = await loadQuoteRequest(requestId);
  if (!r) return { invited: 0 };
  const businesses = await query<Biz>(
    `select ${BIZ_COLS} from leads l join businesses b on b.id = l.business_id join users u on u.id = b.owner_id
      where l.request_id = $1 and l.status <> 'locked' and b.active and b.moderation_status = 'approved' and u.disabled_at is null`, [requestId]);
  await briefFor(r, 'nl'); // always have the Dutch brief (admin view), even when nobody matched
  for (const b of businesses) await sendQuoteRequest(r, b, 1);
  await query(`update service_requests set alerts_sent_at = now(), escalation_stage = 'none', next_round_at = now() + make_interval(secs => $2) where id = $1`,
    [requestId, Math.round((businesses.length ? quoteRoundHours() : 0) * 3600)]);
  const lang: Lang = r.customer_locale === 'en' ? 'en' : 'nl';
  await email(r.id, null, 'customer', 'update', contactOf(r).email, 'quote_confirmation', lang, quoteConfirmationEmail(lang, job(lang, r), businesses.length, signToken('status', [r.id], 60)));
  return { invited: businesses.length };
}

/** One fallback round for a request whose clock ran out: next best 3 businesses, or hand it to the team. */
async function nextRound(id: string): Promise<string> {
  const r = await loadQuoteRequest(id);
  if (!r || !r.quote_mode || r.accepted_business_id || r.hidden || ['completed', 'cancelled', 'expired'].includes(r.status)) {
    await query('update service_requests set next_round_at = null where id = $1', [id]);
    return 'closed';
  }
  const quotes = await queryOne<{ n: number }>(`select count(*)::int as n from quotes where request_id = $1 and status = 'sent'`, [id]);
  if (quotes && quotes.n > 0) { await query('update service_requests set next_round_at = null where id = $1', [id]); return 'has_quotes'; }
  const lang: Lang = r.customer_locale === 'en' ? 'en' : 'nl';
  const statusToken = signToken('status', [r.id], 60);
  const giveUp = async (why: string) => {
    await query('update service_requests set next_round_at = null where id = $1', [id]);
    await email(r.id, null, 'customer', 'update', contactOf(r).email, 'quote_none', lang, noQuotesEmail(lang, job(lang, r), statusToken));
    await notify('request_unanswered', `${categoryLabel('nl', r.category)} (${r.postcode}) – geen offerte na ${r.match_round} ronde(s)`, { requestId: r.id, klant: contactOf(r).name, telefoon: contactOf(r).phone ?? '' });
    return why;
  };
  if (r.match_round >= QUOTE_MAX_ROUNDS) return giveUp('exhausted:max_rounds');
  const postcode4 = r.postcode.replace(/\D/g, '').slice(0, 4);
  const fresh = await query<{ id: string; owner_id: string; owner_locale: Lang }>(
    `with m as (${MATCH_SQL}) select m.id, m.owner_id, m.owner_locale from m
      where not exists (select 1 from leads l where l.request_id = $7 and l.business_id = m.id) order by m.tier, m.rating desc limit ${QUOTE_BATCH}`,
    [...matchParams(r.category, postcode4, r.customer_id), id]);
  if (!fresh.length) return giveUp('exhausted:no_more_businesses');
  const round = r.match_round + 1;
  await transaction(async (c) => {
    for (const b of fresh) {
      await c.query('insert into request_providers(request_id, business_id) values ($1, $2) on conflict do nothing', [id, b.id]);
      await c.query(`insert into leads(request_id, business_id, status, match_round) values ($1, $2, 'new', $3) on conflict (request_id, business_id) do nothing`, [id, b.id, round]);
      const n = notificationText('new_request', b.owner_locale);
      await c.query(`insert into notifications(user_id, type, title, body, request_id) values ($1, 'new_request', $2, $3, $4)`, [b.owner_id, n.title, n.body, id]);
    }
    await c.query(`update service_requests set match_round = $2, next_round_at = now() + make_interval(secs => $3) where id = $1`, [id, round, Math.round(quoteRoundHours() * 3600)]);
  });
  const bizRows = await query<Biz>(`select ${BIZ_COLS} from businesses b join users u on u.id = b.owner_id where b.id = any($1::uuid[])`, [fresh.map((b) => b.id)]);
  for (const b of bizRows) await sendQuoteRequest(r, b, round);
  await email(r.id, null, 'customer', 'update', contactOf(r).email, 'quote_next_round', lang, nextRoundEmail(lang, job(lang, r), bizRows.length, statusToken));
  return `round:${round}:${bizRows.length}`;
}

/** Advances every due request (no quote within the round time). Safe to call often and concurrently: rows are claimed. */
export async function runDueRounds(limit = 5) {
  if (!quotesEnabled()) return { ran: 0, results: [] as string[] };
  const claimed = await query<{ id: string }>(
    `update service_requests set next_round_at = now() + interval '5 minutes'
      where id in (select id from service_requests where next_round_at <= now() and accepted_business_id is null and quote_mode = true
                    order by next_round_at limit $1 for update skip locked)
      returning id`, [limit]);
  const results: string[] = [];
  for (const { id } of claimed) {
    try { results.push(`${id.slice(0, 8)}:${await nextRound(id)}`); }
    catch (e) { console.error('[quotes] round failed', id, e instanceof Error ? e.message : e); results.push(`${id.slice(0, 8)}:error`); }
  }
  return { ran: claimed.length, results };
}

export async function roundsQuietly() {
  try { await runDueRounds(3); } catch (e) { console.error('[quotes] tick failed', e instanceof Error ? e.message : e); }
}

export type QuoteInput = { amountCents: number | null; priceType: 'fixed' | 'from' | 'hourly' | 'visit'; message: string; availableFrom: string | null };

/** What a business sees on its job page for a quote-mode request. */
export async function quoteView(requestId: string, businessId: string, lang: Lang) {
  const r = await loadQuoteRequest(requestId);
  if (!r || !r.quote_mode) return null;
  const lead = await queryOne<{ status: string }>('select status from leads where request_id = $1 and business_id = $2', [requestId, businessId]);
  if (!lead) return null;
  const mine = await queryOne<{ amount_cents: number | null; price_type: string; message: string; available_from: string | null; status: string }>(
    `select amount_cents, price_type, message, to_char(available_from, 'YYYY-MM-DD') as available_from, status from quotes where request_id = $1 and business_id = $2`, [requestId, businessId]);
  const brief = await briefFor(r, lang);
  return {
    brief, answers: answersOf(r), declined: lead.status === 'declined',
    quote: mine ? { amountCents: mine.amount_cents, priceType: mine.price_type, message: mine.message, availableFrom: mine.available_from, status: mine.status } : null,
    chosen: r.accepted_business_id === businessId, chosenOther: Boolean(r.accepted_business_id && r.accepted_business_id !== businessId),
    completed: Boolean(r.completed_at) || r.status === 'completed', contact: r.accepted_business_id === businessId ? contactOf(r) : null,
  };
}

export async function submitQuote(requestId: string, businessId: string, q: QuoteInput) {
  const r = await loadQuoteRequest(requestId);
  if (!r || !r.quote_mode || r.hidden) return { ok: false as const, error: 'not_found' };
  if (r.accepted_business_id || ['completed', 'cancelled', 'expired'].includes(r.status)) return { ok: false as const, error: 'closed' };
  const lead = await queryOne<{ id: string }>('select id from leads where request_id = $1 and business_id = $2', [requestId, businessId]);
  if (!lead) return { ok: false as const, error: 'not_invited' };
  const biz = await queryOne<{ name: string; active: boolean; moderation_status: string }>('select name, active, moderation_status from businesses where id = $1', [businessId]);
  if (!biz || !biz.active || biz.moderation_status !== 'approved') return { ok: false as const, error: 'business_unavailable' };
  const row = await queryOne<{ first: boolean }>(
    `insert into quotes(request_id, business_id, amount_cents, price_type, message, available_from) values ($1, $2, $3, $4, $5, $6)
     on conflict (request_id, business_id) do update set amount_cents = excluded.amount_cents, price_type = excluded.price_type, message = excluded.message,
       available_from = excluded.available_from, updated_at = now() where quotes.status = 'sent'
     returning (xmax = 0) as first`, [requestId, businessId, q.amountCents, q.priceType, q.message, q.availableFrom]);
  if (!row) return { ok: false as const, error: 'closed' };
  await query(`update leads set status = 'contacted', contacted_at = coalesce(contacted_at, now()), updated_at = now() where request_id = $1 and business_id = $2`, [requestId, businessId]);
  await query(`update request_providers set status = 'viewed', responded_at = coalesce(responded_at, now()) where request_id = $1 and business_id = $2`, [requestId, businessId]);
  if (row.first) {
    const count = await queryOne<{ n: number }>(`select count(*)::int as n from quotes where request_id = $1 and status = 'sent'`, [requestId]);
    const lang: Lang = r.customer_locale === 'en' ? 'en' : 'nl';
    await email(r.id, businessId, 'customer', 'update', contactOf(r).email, 'quote_received', lang,
      newQuoteEmail(lang, job(lang, r), { businessName: biz.name, amountCents: q.amountCents, priceType: q.priceType, message: q.message, availableFrom: q.availableFrom }, count?.n ?? 1, signToken('status', [r.id], 60)));
    await query(`insert into notifications(user_id, type, title, body, request_id) values ($1, 'request_update', $2, $3, $4)`,
      [r.customer_id, lang === 'en' ? `New quote from ${biz.name}` : `Nieuwe offerte van ${biz.name}`, lang === 'en' ? 'Compare your quotes and choose one.' : 'Vergelijk je offertes en kies er één.', r.id]);
  }
  return { ok: true as const, updated: !row.first };
}

/** "Not available": this business passes. When every invited business of this round passed and nobody quoted, the next round starts now. */
export async function declineQuote(requestId: string, businessId: string) {
  const r = await loadQuoteRequest(requestId);
  if (!r || !r.quote_mode) return { ok: false as const, error: 'not_found' };
  const upd = await query(`update leads set status = 'declined', updated_at = now() where request_id = $1 and business_id = $2 and status in ('new', 'viewed') returning id`, [requestId, businessId]);
  if (!upd.length) return { ok: true as const };
  await query(`update request_providers set status = 'declined', responded_at = now() where request_id = $1 and business_id = $2`, [requestId, businessId]);
  const open = await queryOne<{ n: number }>(`select count(*)::int as n from leads where request_id = $1 and match_round = $2 and status in ('new', 'viewed', 'contacted')`, [requestId, r.match_round]);
  if (open && open.n === 0 && !r.accepted_business_id) await query('update service_requests set next_round_at = now() where id = $1 and accepted_business_id is null', [requestId]);
  return { ok: true as const };
}

/** The customer's quotes, side by side, with each business's verified rating. */
export async function quotesForRequest(requestId: string) {
  return query<{ id: string; business_id: string; business_name: string; verified: boolean; amount_cents: number | null; price_type: string; message: string; available_from: string | null; status: string; created_at: string; rating: number | null; reviews: number }>(
    `select q.id, q.business_id, b.name as business_name, b.verified, q.amount_cents, q.price_type, q.message, to_char(q.available_from, 'YYYY-MM-DD') as available_from, q.status, q.created_at,
            (select round(avg(rating)::numeric, 1)::float from reviews rv where rv.business_id = b.id and rv.hidden = false) as rating,
            (select count(*)::int from reviews rv where rv.business_id = b.id and rv.hidden = false) as reviews
       from quotes q join businesses b on b.id = q.business_id where q.request_id = $1 and q.status <> 'withdrawn' order by q.created_at`, [requestId]);
}

/** The customer picks a quote: same bookkeeping as an accept (winner gets the details, others are told). */
export async function chooseQuote(requestId: string, quoteId: string) {
  const q = await queryOne<{ business_id: string; status: string }>('select business_id, status from quotes where id = $1 and request_id = $2', [quoteId, requestId]);
  if (!q) return { ok: false as const, error: 'not_found' };
  const res = await acceptJob(requestId, q.business_id, 'quote');
  if (!res.ok) return res;
  await query(`update quotes set status = case when id = $2 then 'chosen' else 'not_chosen' end, updated_at = now() where request_id = $1 and status in ('sent', 'chosen')`, [requestId, quoteId]);
  await query('update service_requests set next_round_at = null where id = $1', [requestId]);
  return { ok: true as const, businessName: res.businessName };
}

/** The job is done (customer on the status page, or the chosen business on its job page): close it and ask for a verified review once. */
export async function markJobDone(requestId: string, by: 'customer' | 'business', businessId?: string) {
  const r = await loadQuoteRequest(requestId);
  if (!r || !r.accepted_business_id) return { ok: false as const, error: 'not_accepted' };
  if (by === 'business' && r.accepted_business_id !== businessId) return { ok: false as const, error: 'not_yours' };
  await transaction(async (c) => {
    await c.query(`update service_requests set status = 'completed', completed_at = coalesce(completed_at, now()), completed_by = coalesce(completed_by, $2), next_round_at = null, escalation_next_at = null where id = $1`, [requestId, by]);
    await c.query(`update conversations set status = 'completed', updated_at = now() where request_id = $1 and business_id = $2 and status in ('active', 'scheduled')`, [requestId, r.accepted_business_id]);
    await c.query(`update leads set status = 'converted', converted_at = coalesce(converted_at, now()), updated_at = now() where request_id = $1 and business_id = $2`, [requestId, r.accepted_business_id]);
  });
  const claimed = await query<{ id: string }>('update service_requests set review_requested_at = now() where id = $1 and review_requested_at is null returning id', [requestId]);
  if (claimed.length) {
    const biz = await queryOne<{ name: string }>('select name from businesses where id = $1', [r.accepted_business_id]);
    const lang: Lang = r.customer_locale === 'en' ? 'en' : 'nl';
    await email(r.id, r.accepted_business_id, 'customer', 'update', contactOf(r).email, 'review_request', lang, reviewRequestEmail(lang, biz?.name ?? '', job(lang, r), signToken('review', [r.id], 60)));
  }
  return { ok: true as const };
}

/** Context for the review page: the job, the business, and whether a review already exists. */
export async function reviewContext(requestId: string) {
  return queryOne<{ id: string; category: string; status: string; business_id: string | null; business_name: string | null; conversation_id: string | null; reviewed: boolean; customer_id: string }>(
    `select r.id, r.category, r.status, r.accepted_business_id as business_id, b.name as business_name, c.id as conversation_id, r.customer_id,
            exists (select 1 from reviews rv where rv.request_id = r.id and rv.customer_id = r.customer_id) as reviewed
       from service_requests r left join businesses b on b.id = r.accepted_business_id
       left join conversations c on c.request_id = r.id and c.business_id = r.accepted_business_id
      where r.id = $1`, [requestId]);
}

/** A verified review: only for a completed job, from that job's customer, once. Never AI-written. */
export async function createJobReview(requestId: string, rating: number, body: string) {
  const ctx = await reviewContext(requestId);
  if (!ctx || !ctx.business_id || !ctx.conversation_id || ctx.status !== 'completed') return { ok: false as const, error: 'review_not_allowed' };
  if (ctx.reviewed) return { ok: false as const, error: 'already_reviewed' };
  try {
    await query(`insert into reviews(conversation_id, request_id, business_id, customer_id, rating, body, source) values ($1, $2, $3, $4, $5, $6, 'job_link')`,
      [ctx.conversation_id, requestId, ctx.business_id, ctx.customer_id, rating, body]);
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { ok: false as const, error: 'already_reviewed' };
    throw e;
  }
  await notify('new_review', `${rating}★ voor ${ctx.business_name} (geverifieerde klus)`, { requestId, beoordeling: body.slice(0, 300) });
  return { ok: true as const, businessName: ctx.business_name, businessId: ctx.business_id };
}

/** Is this a quote-mode request? (The one-tap accept link does not apply to those.) */
export async function isQuoteMode(requestId: string) {
  const r = await queryOne<{ quote_mode: boolean }>('select quote_mode from service_requests where id = $1', [requestId]);
  return Boolean(r?.quote_mode);
}
