import 'server-only';
import { query, queryOne } from '../db';
import type { SessionUser } from '../auth/session';
import { assertAdmin, audit, like, optional, paged, paging } from './core';

export type EmailRow = { id: string; to_address: string; bcc_address: string | null; subject: string; kind: string; status: string; provider_id: string | null; error: string | null; created_at: string };

export async function listEmails(user: SessionUser, f: { q?: string; status?: string; kind?: string; page?: string }, all = false) {
  assertAdmin(user);
  const p = paging(f.page, all ? 100000 : 50);
  const q = (f.q ?? '').trim().slice(0, 100);
  const params = [q, like(q), f.status ?? '', f.kind ?? ''];
  const where = `where ($1 = '' or to_address ilike $2 or subject ilike $2 or kind ilike $2) and ($3 = '' or status = $3) and ($4 = '' or kind like $4 || '%')`;
  const rows = await optional(() => query<EmailRow & { _total: number }>(`select id, to_address, bcc_address, subject, kind, status, provider_id, error, created_at, count(*) over() as _total from email_outbox ${where} order by created_at desc limit ${p.size} offset ${p.offset}`, params), null)
    ?? await query<EmailRow & { _total: number }>(`select id, to_address, null as bcc_address, subject, kind, status, provider_id, error, created_at, count(*) over() as _total from email_outbox ${where} order by created_at desc limit ${p.size} offset ${p.offset}`, params);
  return paged<EmailRow>(rows, p);
}

export type AuditRow = { id: string; action: string; target_type: string; target_id: string | null; details: Record<string, unknown>; created_at: string; actor_email: string | null };
export async function listAudit(user: SessionUser, f: { q?: string; page?: string }, all = false) {
  assertAdmin(user);
  const p = paging(f.page, all ? 100000 : 50);
  const q = (f.q ?? '').trim().slice(0, 100);
  const rows = await query<AuditRow & { _total: number }>(
    `select a.id::text, a.action, a.target_type, a.target_id, a.details, a.created_at, u.email as actor_email, count(*) over() as _total
       from audit_log a left join users u on u.id = a.actor_id
      where ($1 = '' or a.action ilike $2 or a.target_type ilike $2 or coalesce(a.target_id, '') ilike $2 or coalesce(u.email::text, '') ilike $2)
      order by a.created_at desc limit ${p.size} offset ${p.offset}`, [q, like(q)]);
  return paged<AuditRow>(rows, p);
}

const MONTH_START = "(date_trunc('month', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam')";

export async function dashboard(user: SessionUser) {
  assertAdmin(user);
  const base = await queryOne<Record<string, number>>(`select
    (select count(*)::int from businesses) as businesses,
    (select count(*)::int from businesses where moderation_status = 'pending') as businesses_pending,
    (select count(*)::int from users) as users,
    (select count(*)::int from users where created_at > now() - interval '30 days') as users_30d,
    (select count(*)::int from service_requests where status in ('open', 'matched') and not hidden) as open_requests,
    (select count(*)::int from leads where created_at >= ${MONTH_START}) as leads_month,
    (select count(*)::int from contact_messages where status = 'new') as new_contacts`);
  const extra = await optional(() => queryOne<Record<string, number>>(`select
    (select count(*)::int from issues where status <> 'closed') as open_issues,
    (select count(*)::int from payments where status = 'unpaid') as unpaid_payments,
    (select coalesce(sum(amount_cents), 0)::int from payments where status = 'unpaid') as unpaid_cents,
    (select coalesce(sum(amount_cents), 0)::int from payments where status = 'paid' and coalesce(paid_on, created_at::date) >= date_trunc('month', now() at time zone 'Europe/Amsterdam')::date) as revenue_month_cents,
    (select count(*)::int from inbound_emails where status = 'new') as new_emails`), null);
  const activity = await query<{ action: string; target_type: string; target_id: string | null; created_at: string; actor_email: string | null }>(
    `select a.action, a.target_type, a.target_id, a.created_at, u.email as actor_email from audit_log a left join users u on u.id = a.actor_id order by a.created_at desc limit 8`);
  const recent = await query<{ kind: string; label: string; created_at: string; id: string }>(
    `(select 'user' as kind, email::text as label, created_at, id::text from users order by created_at desc limit 5)
     union all (select 'request' as kind, category || ' · ' || postcode as label, created_at, id::text from service_requests order by created_at desc limit 5)
     union all (select 'contact' as kind, name || ': ' || left(coalesce(nullif(subject, ''), body), 60) as label, created_at, id::text from contact_messages order by created_at desc limit 5)
     order by created_at desc limit 10`);
  return { counts: { ...base, ...(extra ?? {}) }, migrationPending: !extra, activity, recent };
}

export async function listPlansAdmin(user: SessionUser) {
  assertAdmin(user);
  return query<{ key: string; name: string; monthly_price_cents: number; included_leads: number; featured: boolean }>('select key, name, monthly_price_cents, included_leads, featured from business_plans order by monthly_price_cents');
}

export async function updatePlan(user: SessionUser, key: string, input: { name: string; monthly_price_cents: number; included_leads: number }) {
  assertAdmin(user);
  if (!['free', 'pro', 'pro_plus'].includes(key) || !input.name || input.monthly_price_cents < 0 || input.included_leads < 0 || input.included_leads > 10000) return false;
  const before = await queryOne('select name, monthly_price_cents, included_leads from business_plans where key = $1', [key]);
  if (!before) return false;
  const after = await queryOne('update business_plans set name = $2, monthly_price_cents = $3, included_leads = $4 where key = $1 returning name, monthly_price_cents, included_leads', [key, input.name.slice(0, 40), input.monthly_price_cents, input.included_leads]);
  await audit(user, 'plan_update', 'plan', key, before, after);
  return true;
}

export async function listReviews(user: SessionUser) {
  assertAdmin(user);
  return query<{ id: string; rating: number; body: string; hidden: boolean; created_at: string; business_name: string; customer_email: string }>(
    `select r.id, r.rating, r.body, r.hidden, r.created_at, b.name as business_name, u.email as customer_email
       from reviews r join businesses b on b.id = r.business_id join users u on u.id = r.customer_id order by r.created_at desc limit 100`);
}
