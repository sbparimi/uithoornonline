import 'server-only';
import { notificationText } from '../notification-text';
import { query, transaction } from '../db';
import type { SessionUser } from '../auth/session';
import { planUsage } from './plans';
import { consumeCredit } from './credits';
import { PRICING_ENABLED } from '../pricing';
import { MATCH_SQL, matchParams } from '../matching';

export type RequestInput = { category: string; description: string; postcode: string; preferredTiming: string; urgency: string; budgetMin: number | null; budgetMax: number | null };

function money(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed < 1_000_000 ? parsed : NaN;
}

export function cleanRequestInput(body: Record<string, unknown>): { value: RequestInput; error: string | null } {
  const s = (k: string, max: number) => String(body[k] ?? '').trim().slice(0, max);
  const value: RequestInput = {
    category: s('category', 120), description: s('description', 3000), postcode: s('postcode', 10).toUpperCase(),
    preferredTiming: s('preferredTiming', 120), urgency: s('urgency', 40) || 'flexible',
    budgetMin: money(body.budgetMin), budgetMax: money(body.budgetMax),
  };
  if (!value.category || value.description.length < 10 || !/^\d{4}\s?[A-Z]{2}$/.test(value.postcode) || !value.preferredTiming) return { value, error: 'invalid_request' };
  if (Number.isNaN(value.budgetMin) || Number.isNaN(value.budgetMax)) return { value, error: 'invalid_request' };
  if (value.budgetMin !== null && value.budgetMax !== null && value.budgetMax < value.budgetMin) return { value, error: 'invalid_request' };
  return { value, error: null };
}

// Matching (category ids + ranking by verified reviews) lives in lib/matching.ts.
export { MATCH_SQL, matchParams } from '../matching';

export type MatchedBusiness = { id: string; name: string; ownerEmail: string; ownerLocale: 'nl' | 'en'; locked: boolean };

export type CreateRequestOptions = {
  /** How many of the best-ranked businesses get a lead (default 10; the AI request flow uses 3). */
  maxMatches?: number;
};

/**
 * Saves a resident's request, matches up to 10 approved businesses (best first, lib/matching.ts), and creates one lead per match.
 * While pricing is switched on (lib/pricing.ts), plan limits are enforced here, server-side: a business
 * that has used its monthly allowance gets the lead as 'locked' (it sees that demand exists, but not the
 * request details) until it upgrades. With pricing off (the default) every lead is delivered, unlimited.
 */
export async function createRequest(user: SessionUser, input: RequestInput, options: CreateRequestOptions = {}) {
  return transaction(async (client) => {
    const { rows: [request] } = await client.query<{ id: string }>(
      `insert into service_requests(customer_id, category, description, postcode, preferred_timing, urgency, budget_min, budget_max)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [user.id, input.category, input.description, input.postcode, input.preferredTiming, input.urgency, input.budgetMin, input.budgetMax]);
    const postcode4 = input.postcode.replace(/\D/g, '').slice(0, 4);
    const { rows: ranked } = await client.query<{ id: string; name: string; owner_id: string; owner_email: string; owner_locale: 'nl' | 'en' }>(MATCH_SQL, matchParams(input.category, postcode4, user.id, input.description));
    const candidates = ranked.slice(0, Math.max(1, Math.min(options.maxMatches ?? 10, 10)));

    const matched: MatchedBusiness[] = [];
    for (const b of candidates) {
      let viaCredit = false;
      let locked = false;
      if (PRICING_ENABLED) {
        // Serialize lead creation per business so two simultaneous requests cannot exceed the limit.
        await client.query('select id from business_subscriptions where business_id = $1 for update', [b.id]);
        const usage = await planUsage(b.id, client);
        // Over the monthly allowance: use an extra (purchased) lead credit if the business has one.
        viaCredit = usage.remaining <= 0 ? await consumeCredit(client, b.id) : false;
        locked = usage.remaining <= 0 && !viaCredit;
      }
      await client.query('insert into request_providers(request_id, business_id) values ($1, $2) on conflict do nothing', [request.id, b.id]);
      await client.query(`insert into leads(request_id, business_id, status, counts_toward_limit) values ($1, $2, $3, $4) on conflict (request_id, business_id) do nothing`, [request.id, b.id, locked ? 'locked' : 'new', !viaCredit]);
      await client.query(
        `insert into notifications(user_id, type, title, body, request_id) values ($1, 'new_request', $2, $3, $4)`,
        [b.owner_id, notificationText(locked ? 'new_request_locked' : 'new_request', b.owner_locale).title, notificationText(locked ? 'new_request_locked' : 'new_request', b.owner_locale).body, request.id]);
      matched.push({ id: b.id, name: b.name, ownerEmail: b.owner_email, ownerLocale: b.owner_locale, locked });
    }
    const delivered = matched.filter((m) => !m.locked).length;
    await client.query(`update service_requests set status = $2 where id = $1`, [request.id, delivered > 0 ? 'matched' : 'open']);
    await client.query(`insert into analytics_events(event_name, request_id, metadata) values ('request_submitted', $1, $2)`, [request.id, JSON.stringify({ category: input.category, matched: matched.length, delivered })]);
    return { id: request.id, matched, delivered };
  });
}

export async function listOwnRequests(user: SessionUser) {
  return query<{ id: string; category: string; description: string; postcode: string; status: string; created_at: string; matched: number; conversations: number }>(
    `select r.id, r.category, r.description, r.postcode, r.status, r.created_at,
            (select count(*)::int from leads l where l.request_id = r.id and l.status <> 'locked') as matched,
            (select count(*)::int from conversations c where c.request_id = r.id) as conversations
       from service_requests r where r.customer_id = $1 order by r.created_at desc limit 100`, [user.id]);
}
