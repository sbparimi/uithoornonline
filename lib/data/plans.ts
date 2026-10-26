import 'server-only';
import type { PoolClient } from 'pg';
import { query, queryOne } from '../db';

export type PlanKey = 'free' | 'pro' | 'pro_plus';
export type PlanUsage = { plan: PlanKey; planName: string; includedLeads: number; usedThisMonth: number; remaining: number; lockedThisMonth: number };

// Lead limits per plan (Free 3, Pro 15, Pro+ 50 per calendar month, Europe/Amsterdam) live in
// business_plans.included_leads and are enforced in lib/data/requests.ts when leads are created.
const MONTH_START = "(date_trunc('month', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam')";

type Runner = { query: PoolClient['query'] } | null;

export async function planUsage(businessId: string, client: Runner = null): Promise<PlanUsage> {
  const sql = `select coalesce(s.plan_key, 'free') as plan, p.name as plan_name, p.included_leads,
      (select count(*)::int from leads l where l.business_id = $1 and l.counts_toward_limit and l.status <> 'locked' and l.created_at >= ${MONTH_START}) as used,
      (select count(*)::int from leads l where l.business_id = $1 and l.status = 'locked' and l.created_at >= ${MONTH_START}) as locked
    from business_plans p
    left join business_subscriptions s on s.business_id = $1 and s.status in ('active', 'trialing', 'past_due')
    where p.key = coalesce(s.plan_key, 'free')`;
  type Row = { plan: PlanKey; plan_name: string; included_leads: number; used: number; locked: number };
  const row = client ? (await client.query<Row>(sql, [businessId])).rows[0] : await queryOne<Row>(sql, [businessId]);
  const included = row?.included_leads ?? 3;
  const used = row?.used ?? 0;
  return { plan: row?.plan ?? 'free', planName: row?.plan_name ?? 'Gratis', includedLeads: included, usedThisMonth: used, remaining: Math.max(0, included - used), lockedThisMonth: row?.locked ?? 0 };
}

export async function listPlans() {
  return query<{ key: PlanKey; name: string; monthly_price_cents: number; included_leads: number; featured: boolean }>('select key, name, monthly_price_cents, included_leads, featured from business_plans order by monthly_price_cents');
}
