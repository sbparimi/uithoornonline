import 'server-only';
import { query, transaction } from '../db';
import type { SessionUser } from '../auth/session';
import { planUsage } from './plans';
import { consumeCredit } from './credits';
import { PRICING_ENABLED } from '../pricing';

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

// Category → keyword regex, ported from the old match_service_request() SQL function.
const MATCH_SQL = `
  select b.id, b.name, b.owner_id, u.email as owner_email, u.locale as owner_locale
    from businesses b join users u on u.id = b.owner_id
   where b.moderation_status = 'approved' and b.active = true and u.disabled_at is null
     and b.owner_id <> $3
     and lower(b.category) not like '%indian food%'
     and lower(b.category) not like '%workshop%'
     -- No hard postcode filter (the site only serves Uithoorn & De Kwakel); same postcode ranks first.
     and (
          ($1 like '%garden%' and lower(b.category || ' ' || b.description) ~ '(garden|tuin|hovenier|landschap|bestrating|schutting|buiten)')
       or ($1 like '%tuin%' and lower(b.category || ' ' || b.description) ~ '(garden|tuin|hovenier|landschap|bestrating|schutting|buiten)')
       or ($1 like '%plumb%' and lower(b.category || ' ' || b.description) ~ '(plumb|loodgiet|water|lekkage|verwarming|cv)')
       or ($1 like '%loodgiet%' and lower(b.category || ' ' || b.description) ~ '(plumb|loodgiet|water|lekkage|verwarming|cv)')
       or ($1 like '%electric%' and lower(b.category || ' ' || b.description) ~ '(elektr|install|electri)')
       or ($1 like '%elektr%' and lower(b.category || ' ' || b.description) ~ '(elektr|install|electri)')
       or ($1 like '%clean%' and lower(b.category || ' ' || b.description) ~ '(clean|schoon|huishoud|ramen|window)')
       or ($1 like '%schoon%' and lower(b.category || ' ' || b.description) ~ '(clean|schoon|huishoud|ramen|window)')
       or ($1 like '%transport%' and lower(b.category || ' ' || b.description) ~ '(transport|verhuis|moving|koerier|courier|delivery)')
       or ($1 like '%verhuis%' and lower(b.category || ' ' || b.description) ~ '(transport|verhuis|moving|koerier|courier|delivery)')
       or ($1 like '%handyman%' and lower(b.category || ' ' || b.description) ~ '(handyman|klus|montage|reparatie|repair|onderhoud)')
       or ($1 like '%klus%' and lower(b.category || ' ' || b.description) ~ '(handyman|klus|montage|reparatie|repair|onderhoud)')
       or ($1 like '%home improvement%' and lower(b.category || ' ' || b.description) ~ '(klus|bouw|renov|schilder|timmer|vloer|paving|tiling|fenc)')
       or ($1 like '%auto%' and lower(b.category || ' ' || b.description) ~ '(auto|garage|car|fiets|bicycle|repair)')
       or ($1 like '%food%' and lower(b.category || ' ' || b.description) ~ '(food|eten|cater|restaurant|bakery)')
       or ($1 like '%beauty%' and lower(b.category || ' ' || b.description) ~ '(barber|kapper|hair|beauty|salon)')
       or lower(b.category || ' ' || b.description) like '%' || split_part($1, ' ', 1) || '%'
     )
   order by case when left(regexp_replace(coalesce(b.postcode, ''), '[^0-9]', '', 'g'), 4) = $2 then 0 else 1 end, b.featured desc, b.created_at desc
   limit 10`;

export type MatchedBusiness = { id: string; name: string; ownerEmail: string; ownerLocale: 'nl' | 'en'; locked: boolean };

/**
 * Saves a resident's request, matches up to 10 approved businesses, and creates one lead per match.
 * While pricing is switched on (lib/pricing.ts), plan limits are enforced here, server-side: a business
 * that has used its monthly allowance gets the lead as 'locked' (it sees that demand exists, but not the
 * request details) until it upgrades. With pricing off (the default) every lead is delivered, unlimited.
 */
export async function createRequest(user: SessionUser, input: RequestInput) {
  return transaction(async (client) => {
    const { rows: [request] } = await client.query<{ id: string }>(
      `insert into service_requests(customer_id, category, description, postcode, preferred_timing, urgency, budget_min, budget_max)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [user.id, input.category, input.description, input.postcode, input.preferredTiming, input.urgency, input.budgetMin, input.budgetMax]);
    const postcode4 = input.postcode.replace(/\D/g, '').slice(0, 4);
    const { rows: candidates } = await client.query<{ id: string; name: string; owner_id: string; owner_email: string; owner_locale: 'nl' | 'en' }>(MATCH_SQL, [input.category.toLowerCase(), postcode4, user.id]);

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
        [b.owner_id, locked ? 'Nieuwe aanvraag (limiet bereikt)' : 'Nieuwe lokale aanvraag', locked ? 'Er is een nieuwe aanvraag voor jouw bedrijf. Upgrade je pakket om hem te bekijken.' : 'Er is een nieuwe aanvraag die past bij jouw bedrijf.', request.id]);
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
