import 'server-only';
import type { PoolClient } from 'pg';
import { query, queryOne, transaction } from '../db';
import type { SessionUser } from '../auth/session';
import { addCredits, unlockLockedLeads } from '../data/credits';
import { assertAdmin, audit, isId, like, needsSchema, optional, paged, paging } from './core';

// Manual payments ledger. Payments arrive via WhatsApp/Tikkie/bank/cash; an admin records them here.
// Applying a PAID payment updates the business: a plan payment sets the plan for N months, a lead
// payment adds extra lead credits; then this month's locked leads that now fit are unlocked.

export const METHODS = ['whatsapp', 'tikkie', 'bank', 'cash', 'other'] as const;
export const KINDS = ['plan', 'lead', 'other'] as const;
export type Payment = {
  id: string; business_id: string | null; business_name: string; amount_cents: number; kind: string; plan_key: string | null; lead_credits: number; months: number;
  method: string; status: 'paid' | 'unpaid' | 'refunded'; paid_on: string | null; note: string | null; applied_at: string | null; receipt_sent_at: string | null; created_at: string; updated_at: string;
  owner_email?: string | null; owner_locale?: 'nl' | 'en' | null;
};

export type PaymentFilter = { q?: string; status?: string; month?: string; page?: string };

export async function listPayments(user: SessionUser, f: PaymentFilter, all = false) {
  assertAdmin(user);
  const p = paging(f.page, all ? 100000 : 25);
  const q = (f.q ?? '').trim().slice(0, 100);
  const month = /^\d{4}-\d{2}$/.test(f.month ?? '') ? f.month! : '';
  return optional(async () => paged<Payment>(await query<Payment & { _total: number }>(
    `select p.*, count(*) over() as _total from payments p
      where ($1 = '' or p.business_name ilike $2 or coalesce(p.note, '') ilike $2 or p.method ilike $2)
        and ($3 = '' or p.status = $3)
        and ($4 = '' or to_char(coalesce(p.paid_on, p.created_at::date), 'YYYY-MM') = $4)
      order by coalesce(p.paid_on, p.created_at::date) desc, p.created_at desc limit ${p.size} offset ${p.offset}`, [q, like(q), f.status ?? '', month]), p), null);
}

export async function monthlyTotals(user: SessionUser) {
  assertAdmin(user);
  return optional(() => query<{ month: string; paid_cents: number; paid_count: number; unpaid_cents: number; unpaid_count: number }>(
    `select to_char(date_trunc('month', coalesce(paid_on, created_at::date)), 'YYYY-MM') as month,
            coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::int as paid_cents, count(*) filter (where status = 'paid')::int as paid_count,
            coalesce(sum(amount_cents) filter (where status = 'unpaid'), 0)::int as unpaid_cents, count(*) filter (where status = 'unpaid')::int as unpaid_count
       from payments group by 1 order by 1 desc limit 12`), []);
}

export async function getPayment(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return null;
  return optional(() => queryOne<Payment>(
    `select p.*, u.email as owner_email, u.locale as owner_locale from payments p left join businesses b on b.id = p.business_id left join users u on u.id = b.owner_id where p.id = $1`, [id]), null);
}

export type PaymentInput = { business_id: string | null; amount_cents: number; kind: string; plan_key: string | null; lead_credits: number; months: number; method: string; status: 'paid' | 'unpaid' | 'refunded'; paid_on: string | null; note: string | null };

export function cleanPayment(body: Record<string, unknown>): { value: PaymentInput; error: string | null } {
  const s = (k: string, max = 200) => String(body[k] ?? '').trim().slice(0, max);
  const amount = Number(s('amount').replace(/\s|€/g, '').replace(',', '.'));
  const kind = s('kind', 10); const plan = s('plan_key', 20); const status = s('status', 10);
  const value: PaymentInput = {
    business_id: isId(s('business_id', 40)) ? s('business_id', 40) : null,
    amount_cents: Number.isFinite(amount) ? Math.round(amount * 100) : -1,
    kind: (KINDS as readonly string[]).includes(kind) ? kind : 'other',
    plan_key: ['free', 'pro', 'pro_plus'].includes(plan) ? plan : null,
    lead_credits: Math.max(0, Math.min(1000, Number.parseInt(s('lead_credits', 6), 10) || 0)),
    months: Math.max(1, Math.min(24, Number.parseInt(s('months', 3), 10) || 1)),
    method: (METHODS as readonly string[]).includes(s('method', 20)) ? s('method', 20) : 'other',
    status: (['paid', 'unpaid', 'refunded'].includes(status) ? status : 'unpaid') as PaymentInput['status'],
    paid_on: /^\d{4}-\d{2}-\d{2}$/.test(s('paid_on', 10)) ? s('paid_on', 10) : null,
    note: s('note', 1000) || null,
  };
  if (value.amount_cents < 0 || value.amount_cents > 10_000_000) return { value, error: 'invalid_amount' };
  if (value.kind === 'plan' && !value.plan_key) return { value, error: 'plan_required' };
  if (value.kind !== 'plan') value.plan_key = null;
  if (value.kind === 'lead' && value.lead_credits < 1) value.lead_credits = 1;
  if (value.kind === 'other') value.lead_credits = 0;
  if (value.status === 'paid' && !value.paid_on) value.paid_on = new Date().toISOString().slice(0, 10);
  if ((value.kind === 'plan' || value.kind === 'lead') && !value.business_id) return { value, error: 'business_required' };
  return { value, error: null };
}

async function applyEffects(client: PoolClient, p: Payment) {
  if (!p.business_id) return { unlocked: 0 };
  if (p.kind === 'plan' && p.plan_key) {
    await client.query(
      `insert into business_subscriptions(business_id, plan_key, status, payment_provider, note, current_period_end)
       values ($1, $2, 'active', 'manual', $4, case when $2 = 'free' then null else now() + make_interval(months => $3) end)
       on conflict (business_id) do update set
         current_period_end = case when excluded.plan_key = 'free' then null
           when business_subscriptions.plan_key = excluded.plan_key and business_subscriptions.current_period_end > now() then business_subscriptions.current_period_end + make_interval(months => $3)
           else now() + make_interval(months => $3) end,
         plan_key = excluded.plan_key, status = 'active', payment_provider = 'manual', note = excluded.note, updated_at = now()`,
      [p.business_id, p.plan_key, p.months, `payment ${p.id.slice(0, 8)}`]);
  }
  if (p.lead_credits > 0) await addCredits(client, p.business_id, p.lead_credits);
  const unlocked = await unlockLockedLeads(client, p.business_id);
  await client.query('update payments set applied_at = now() where id = $1', [p.id]);
  return { unlocked };
}

async function revertEffects(client: PoolClient, p: Payment) {
  if (p.business_id && p.lead_credits > 0) await addCredits(client, p.business_id, -p.lead_credits);
  await client.query('update payments set applied_at = null where id = $1', [p.id]);
}

async function businessName(client: PoolClient, id: string | null) {
  if (!id) return '';
  const { rows: [b] } = await client.query<{ name: string }>('select name from businesses where id = $1', [id]);
  return b?.name ?? '';
}

export async function createPayment(user: SessionUser, v: PaymentInput) {
  assertAdmin(user);
  return needsSchema(() => transaction(async (client) => {
    const name = await businessName(client, v.business_id);
    if (v.business_id && !name) return { error: 'business_not_found' as const };
    const { rows: [p] } = await client.query<Payment>(
      `insert into payments(business_id, business_name, amount_cents, kind, plan_key, lead_credits, months, method, status, paid_on, note, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
      [v.business_id, name, v.amount_cents, v.kind, v.plan_key, v.lead_credits, v.months, v.method, v.status, v.paid_on, v.note, user.id]);
    const effect = p.status === 'paid' ? await applyEffects(client, p) : { unlocked: 0 };
    await audit(user, 'payment_create', 'payment', p.id, null, { ...p, applied: p.status === 'paid', unlocked: effect.unlocked }, {}, client);
    return { id: p.id, applied: p.status === 'paid', unlocked: effect.unlocked };
  }));
}

/** Edits a payment. Becoming paid applies it; leaving paid reverts its credits (a plan is left as is). */
export async function updatePayment(user: SessionUser, id: string, v: PaymentInput) {
  assertAdmin(user);
  if (!isId(id)) return { error: 'not_found' as const };
  return needsSchema(() => transaction(async (client) => {
    const { rows: [before] } = await client.query<Payment>('select * from payments where id = $1 for update', [id]);
    if (!before) return { error: 'not_found' as const };
    const name = v.business_id === before.business_id ? before.business_name : await businessName(client, v.business_id);
    if (before.applied_at) await revertEffects(client, before);
    const { rows: [after] } = await client.query<Payment>(
      `update payments set business_id = $2, business_name = $3, amount_cents = $4, kind = $5, plan_key = $6, lead_credits = $7, months = $8, method = $9, status = $10, paid_on = $11, note = $12, updated_at = now()
       where id = $1 returning *`, [id, v.business_id, name, v.amount_cents, v.kind, v.plan_key, v.lead_credits, v.months, v.method, v.status, v.paid_on, v.note]);
    // Re-apply only what is new: a plan payment that was already applied is not extended twice.
    let unlocked = 0;
    if (after.status === 'paid') {
      const planAlreadyApplied = Boolean(before.applied_at) && before.kind === 'plan' && before.plan_key === after.plan_key && before.months === after.months && before.business_id === after.business_id;
      unlocked = (await applyEffects(client, planAlreadyApplied ? { ...after, kind: 'lead_only' } : after)).unlocked;
    }
    await audit(user, 'payment_update', 'payment', id, before, after, { unlocked }, client);
    return { ok: true, becamePaid: before.status !== 'paid' && after.status === 'paid', unlocked };
  }));
}

export async function setPaymentStatus(user: SessionUser, id: string, status: 'paid' | 'unpaid') {
  assertAdmin(user);
  const p = await getPayment(user, id);
  if (!p) return { error: 'not_found' as const };
  const { owner_email: _e, owner_locale: _l, ...rest } = p;
  return updatePayment(user, id, {
    business_id: rest.business_id, amount_cents: rest.amount_cents, kind: rest.kind, plan_key: rest.plan_key, lead_credits: rest.lead_credits, months: rest.months, method: rest.method,
    status, paid_on: status === 'paid' ? (rest.paid_on ?? new Date().toISOString().slice(0, 10)) : rest.paid_on, note: rest.note,
  });
}

export async function deletePayment(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return false;
  return needsSchema(() => transaction(async (client) => {
    const { rows: [before] } = await client.query<Payment>('select * from payments where id = $1 for update', [id]);
    if (!before) return false;
    if (before.applied_at) await revertEffects(client, before);
    await client.query('delete from payments where id = $1', [id]);
    await audit(user, 'payment_delete', 'payment', id, before, null, {}, client);
    return true;
  }));
}

export async function markReceiptSent(id: string) {
  await query('update payments set receipt_sent_at = now() where id = $1', [id]).catch(() => undefined);
}

export function describePayment(p: Pick<Payment, 'kind' | 'plan_key' | 'months' | 'lead_credits' | 'note'>, lang: 'nl' | 'en') {
  const plan = p.plan_key === 'pro_plus' ? 'Pro+' : p.plan_key === 'pro' ? 'Pro' : 'Gratis';
  if (p.kind === 'plan') return lang === 'en' ? `${plan} plan, ${p.months} month${p.months === 1 ? '' : 's'}` : `${plan}-pakket, ${p.months} maand${p.months === 1 ? '' : 'en'}`;
  if (p.kind === 'lead') return lang === 'en' ? `${p.lead_credits} extra lead${p.lead_credits === 1 ? '' : 's'}` : `${p.lead_credits} losse lead${p.lead_credits === 1 ? '' : 's'}`;
  return p.note || (lang === 'en' ? 'Payment' : 'Betaling');
}
