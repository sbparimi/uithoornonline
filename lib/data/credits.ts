import 'server-only';
import type { PoolClient } from 'pg';

// Extra (purchased) lead credits, on top of the plan's monthly allowance (table business_lead_credits,
// migration 0002). A lead paid with a credit is stored with counts_toward_limit = false, so it does
// not use up the monthly plan allowance. Everything here tolerates the table not existing yet.

const MONTH_START = "(date_trunc('month', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam')";
const missing = (e: unknown) => ['42P01', '42703'].includes(String((e as { code?: string })?.code));

/** Uses one credit inside the caller's transaction. Returns true when a credit was available. */
export async function consumeCredit(client: PoolClient, businessId: string): Promise<boolean> {
  await client.query('savepoint use_credit');
  try {
    const r = await client.query('update business_lead_credits set credits = credits - 1, updated_at = now() where business_id = $1 and credits > 0 returning credits', [businessId]);
    await client.query('release savepoint use_credit');
    return (r.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query('rollback to savepoint use_credit');
    if (missing(error)) return false;
    throw error;
  }
}

export async function creditBalance(client: PoolClient, businessId: string): Promise<number> {
  await client.query('savepoint read_credit');
  try {
    const r = await client.query<{ credits: number }>('select credits from business_lead_credits where business_id = $1', [businessId]);
    await client.query('release savepoint read_credit');
    return r.rows[0]?.credits ?? 0;
  } catch (error) {
    await client.query('rollback to savepoint read_credit');
    if (missing(error)) return 0;
    throw error;
  }
}

/** Adds (or removes, with a negative delta) credits; never below zero. Returns the new balance. */
export async function addCredits(client: PoolClient, businessId: string, delta: number): Promise<number> {
  const r = await client.query<{ credits: number }>(
    `insert into business_lead_credits(business_id, credits) values ($1, greatest(0, $2))
     on conflict (business_id) do update set credits = greatest(0, business_lead_credits.credits + $2), updated_at = now()
     returning credits`, [businessId, delta]);
  return r.rows[0].credits;
}

/**
 * Unlocks this month's locked leads of a business, oldest first: first within the plan's remaining
 * monthly allowance, then by spending extra credits. Returns how many leads were unlocked.
 */
export async function unlockLockedLeads(client: PoolClient, businessId: string): Promise<number> {
  const { rows: [u] } = await client.query<{ included: number; used: number }>(
    `select coalesce(p.included_leads, 3) as included,
            (select count(*)::int from leads where business_id = $1 and counts_toward_limit and status <> 'locked' and created_at >= ${MONTH_START}) as used
       from business_plans p
       left join business_subscriptions s on s.business_id = $1 and s.status in ('active', 'trialing', 'past_due')
      where p.key = coalesce(s.plan_key, 'free')`, [businessId]);
  let unlocked = 0;
  const room = Math.max(0, (u?.included ?? 3) - (u?.used ?? 0));
  if (room > 0) {
    const r = await client.query(`update leads set status = 'new', updated_at = now() where id in (select id from leads where business_id = $1 and status = 'locked' and created_at >= ${MONTH_START} order by created_at limit $2)`, [businessId, room]);
    unlocked += r.rowCount ?? 0;
  }
  const { rows: locked } = await client.query<{ id: string }>(`select id from leads where business_id = $1 and status = 'locked' and created_at >= ${MONTH_START} order by created_at`, [businessId]);
  for (const lead of locked) {
    if (!(await consumeCredit(client, businessId))) break;
    await client.query(`update leads set status = 'new', counts_toward_limit = false, updated_at = now() where id = $1`, [lead.id]);
    unlocked += 1;
  }
  return unlocked;
}
