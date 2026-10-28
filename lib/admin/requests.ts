import 'server-only';
import { query, queryOne, transaction } from '../db';
import type { SessionUser } from '../auth/session';
import { assertAdmin, audit, isId, like, paged, paging } from './core';

export const REQUEST_STATUSES = ['open', 'matched', 'in_conversation', 'scheduled', 'completed', 'cancelled', 'expired'] as const;
export const LEAD_STATUSES = ['new', 'locked', 'viewed', 'accepted', 'declined', 'contacted', 'converted', 'closed'] as const;

export type RequestRow = { id: string; category: string; description: string; postcode: string; status: string; hidden: boolean; created_at: string; customer_email: string | null; leads: number };
export type RequestFilter = { q?: string; status?: string; hidden?: string; page?: string };

export async function listRequests(user: SessionUser, f: RequestFilter, all = false) {
  assertAdmin(user);
  const p = paging(f.page, all ? 100000 : 25);
  const q = (f.q ?? '').trim().slice(0, 100);
  const rows = await query<RequestRow & { _total: number }>(
    `select r.id, r.category, r.description, r.postcode, r.status, r.hidden, r.created_at, u.email as customer_email,
            (select count(*)::int from leads l where l.request_id = r.id) as leads, count(*) over() as _total
       from service_requests r left join users u on u.id = r.customer_id
      where ($1 = '' or r.category ilike $2 or r.description ilike $2 or r.postcode ilike $2 or coalesce(u.email::text, '') ilike $2)
        and ($3 = '' or r.status::text = $3)
        and ($4 = '' or ($4 = 'hidden' and r.hidden) or ($4 = 'visible' and not r.hidden))
      order by r.created_at desc limit ${p.size} offset ${p.offset}`, [q, like(q), f.status ?? '', f.hidden ?? '']);
  return paged<RequestRow>(rows, p);
}

export async function getRequest(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return null;
  const request = await queryOne<RequestRow & { preferred_timing: string; urgency: string; budget_min: string | null; budget_max: string | null; hidden_reason: string | null; customer_id: string; customer_name: string | null; customer_phone: string | null }>(
    `select r.*, u.email as customer_email, u.full_name as customer_name, u.phone as customer_phone, 0 as leads
       from service_requests r left join users u on u.id = r.customer_id where r.id = $1`, [id]);
  if (!request) return null;
  const leads = await query<{ id: string; business_id: string; business_name: string; status: string; created_at: string; counts_toward_limit: boolean; conversation_id: string | null }>(
    `select l.id, l.business_id, b.name as business_name, l.status, l.created_at, l.counts_toward_limit,
            (select c.id from conversations c where c.request_id = l.request_id and c.business_id = l.business_id) as conversation_id
       from leads l join businesses b on b.id = l.business_id where l.request_id = $1 order by l.created_at`, [id]);
  return { request, leads };
}

export async function updateRequest(user: SessionUser, id: string, input: { status: string; hidden: boolean; hidden_reason: string | null; category: string; description: string; postcode: string }) {
  assertAdmin(user);
  if (!isId(id) || !(REQUEST_STATUSES as readonly string[]).includes(input.status)) return { error: 'invalid_request' as const };
  if (input.description.length < 10 || !input.category || !input.postcode) return { error: 'invalid_request' as const };
  const before = await queryOne<Record<string, unknown>>('select status, hidden, hidden_reason, category, description, postcode from service_requests where id = $1', [id]);
  if (!before) return { error: 'not_found' as const };
  const after = await queryOne<Record<string, unknown>>(
    'update service_requests set status = $2, hidden = $3, hidden_reason = $4, category = $5, description = $6, postcode = $7, updated_at = now() where id = $1 returning status, hidden, hidden_reason, category, description, postcode',
    [id, input.status, input.hidden, input.hidden ? input.hidden_reason : null, input.category.slice(0, 120), input.description.slice(0, 3000), input.postcode.slice(0, 10)]);
  await audit(user, 'request_update', 'request', id, before, after);
  return { ok: true };
}

export async function setRequestHidden(user: SessionUser, id: string, hidden: boolean, reason: string | null) {
  assertAdmin(user);
  if (!isId(id)) return false;
  const before = await queryOne<Record<string, unknown>>('select hidden, hidden_reason from service_requests where id = $1', [id]);
  if (!before) return false;
  const after = await queryOne('update service_requests set hidden = $2, hidden_reason = $3, updated_at = now() where id = $1 returning hidden, hidden_reason', [id, hidden, hidden ? reason : null]);
  await audit(user, hidden ? 'request_hide' : 'request_unhide', 'request', id, before, after);
  return true;
}

export async function deleteRequest(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return false;
  const before = await queryOne<Record<string, unknown>>('select * from service_requests where id = $1', [id]);
  if (!before) return false;
  await query('delete from service_requests where id = $1', [id]);
  await audit(user, 'request_delete', 'request', id, before, null);
  return true;
}

/** Sends (reassigns) a request to a business as a new lead. Admin-assigned leads don't count toward the plan limit. */
export async function assignLead(user: SessionUser, requestId: string, businessId: string) {
  assertAdmin(user);
  if (!isId(requestId) || !isId(businessId)) return { error: 'invalid_request' as const };
  return transaction(async (client) => {
    const { rows: [b] } = await client.query<{ id: string; name: string; owner_id: string | null; owner_email: string | null; owner_locale: 'nl' | 'en' | null }>(
      'select b.id, b.name, b.owner_id, u.email as owner_email, u.locale as owner_locale from businesses b left join users u on u.id = b.owner_id where b.id = $1', [businessId]);
    const { rows: [r] } = await client.query<{ id: string; category: string }>('select id, category from service_requests where id = $1', [requestId]);
    if (!b || !r) return { error: 'not_found' as const };
    await client.query('insert into request_providers(request_id, business_id) values ($1, $2) on conflict do nothing', [requestId, businessId]);
    const ins = await client.query<{ id: string }>(`insert into leads(request_id, business_id, status, counts_toward_limit) values ($1, $2, 'new', false) on conflict (request_id, business_id) do nothing returning id`, [requestId, businessId]);
    if (!ins.rowCount) return { error: 'already_assigned' as const };
    if (b.owner_id) await client.query(`insert into notifications(user_id, type, title, body, request_id) values ($1, 'new_request', 'Nieuwe lokale aanvraag', 'Er is een nieuwe aanvraag die past bij jouw bedrijf.', $2)`, [b.owner_id, requestId]);
    await client.query(`update service_requests set status = 'matched' where id = $1 and status = 'open'`, [requestId]);
    await audit(user, 'lead_assign', 'request', requestId, null, { business_id: businessId, business_name: b.name, lead_id: ins.rows[0].id }, {}, client);
    return { ok: true, business: b, category: r.category };
  });
}

export async function setLeadStatus(user: SessionUser, leadId: string, status: string) {
  assertAdmin(user);
  if (!isId(leadId) || !(LEAD_STATUSES as readonly string[]).includes(status)) return false;
  const before = await queryOne<{ status: string; request_id: string }>('select status, request_id from leads where id = $1', [leadId]);
  if (!before) return false;
  await query('update leads set status = $2, updated_at = now() where id = $1', [leadId, status]);
  await audit(user, 'lead_status', 'lead', leadId, before, { status });
  return true;
}

export async function deleteLead(user: SessionUser, leadId: string) {
  assertAdmin(user);
  if (!isId(leadId)) return false;
  const row = await queryOne<Record<string, unknown> & { request_id: string; business_id: string }>('delete from leads where id = $1 returning *', [leadId]);
  if (!row) return false;
  await query('delete from request_providers where request_id = $1 and business_id = $2', [row.request_id, row.business_id]);
  await audit(user, 'lead_delete', 'lead', leadId, row, null);
  return true;
}

export type LeadRow = { id: string; status: string; created_at: string; business_name: string; category: string; postcode: string; request_id: string };
export async function listLeads(user: SessionUser, f: { q?: string; status?: string; page?: string }, all = false) {
  assertAdmin(user);
  const p = paging(f.page, all ? 100000 : 50);
  const q = (f.q ?? '').trim().slice(0, 100);
  const rows = await query<LeadRow & { _total: number }>(
    `select l.id, l.status, l.created_at, b.name as business_name, r.category, r.postcode, r.id as request_id, count(*) over() as _total
       from leads l join businesses b on b.id = l.business_id join service_requests r on r.id = l.request_id
      where ($1 = '' or b.name ilike $2 or r.category ilike $2 or r.postcode ilike $2) and ($3 = '' or l.status = $3)
      order by l.created_at desc limit ${p.size} offset ${p.offset}`, [q, like(q), f.status ?? '']);
  return paged<LeadRow>(rows, p);
}
