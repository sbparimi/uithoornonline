import 'server-only';
import { query, queryOne } from '../db';
import type { SessionUser } from '../auth/session';
import { assertAdmin, audit, isId, like, needsSchema, optional, paged, paging } from './core';

export const ISSUE_STATUSES = ['open', 'in_progress', 'closed'] as const;
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type Issue = { id: string; title: string; body: string; status: string; priority: string; source: string; notes: string; contact_message_id: string | null; inbound_email_id: string | null; business_id: string | null; business_name?: string | null; created_at: string; updated_at: string; closed_at: string | null };
export type IssueFilter = { q?: string; status?: string; priority?: string; page?: string };

export async function listIssues(user: SessionUser, f: IssueFilter, all = false) {
  assertAdmin(user);
  const p = paging(f.page, all ? 100000 : 25);
  const q = (f.q ?? '').trim().slice(0, 100);
  return optional(async () => paged<Issue>(await query<Issue & { _total: number }>(
    `select i.*, b.name as business_name, count(*) over() as _total from issues i left join businesses b on b.id = i.business_id
      where ($1 = '' or i.title ilike $2 or i.body ilike $2 or i.notes ilike $2) and ($3 = '' or i.status = $3) and ($4 = '' or i.priority = $4)
      order by case i.status when 'open' then 0 when 'in_progress' then 1 else 2 end, case i.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, i.created_at desc
      limit ${p.size} offset ${p.offset}`, [q, like(q), f.status ?? '', f.priority ?? '']), p), null);
}

export async function getIssue(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return null;
  return optional(() => queryOne<Issue>('select i.*, b.name as business_name from issues i left join businesses b on b.id = i.business_id where i.id = $1', [id]), null);
}

export type IssueInput = { title: string; body: string; status: string; priority: string; notes: string; business_id: string | null; source?: string; contact_message_id?: string | null; inbound_email_id?: string | null };
export function cleanIssue(body: Record<string, unknown>): { value: IssueInput; error: string | null } {
  const s = (k: string, max: number) => String(body[k] ?? '').trim().slice(0, max);
  const status = s('status', 20); const priority = s('priority', 20);
  const value: IssueInput = {
    title: s('title', 200), body: s('body', 10000), notes: s('notes', 20000),
    status: (ISSUE_STATUSES as readonly string[]).includes(status) ? status : 'open',
    priority: (PRIORITIES as readonly string[]).includes(priority) ? priority : 'normal',
    business_id: isId(s('business_id', 40)) ? s('business_id', 40) : null,
  };
  if (value.title.length < 2) return { value, error: 'invalid_title' };
  return { value, error: null };
}

export async function createIssue(user: SessionUser | null, v: IssueInput) {
  if (user) assertAdmin(user);
  const row = await needsSchema(() => queryOne<Issue>(
    `insert into issues(title, body, status, priority, source, notes, business_id, contact_message_id, inbound_email_id, created_by, closed_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, case when $3 = 'closed' then now() end) returning *`,
    [v.title, v.body, v.status, v.priority, v.source ?? 'admin', v.notes, v.business_id, v.contact_message_id ?? null, v.inbound_email_id ?? null, user?.id ?? null]));
  if (user) await audit(user, 'issue_create', 'issue', row!.id, null, row);
  return row!;
}

export async function updateIssue(user: SessionUser, id: string, v: IssueInput) {
  assertAdmin(user);
  if (!isId(id)) return false;
  return needsSchema(async () => {
    const before = await queryOne<Issue>('select * from issues where id = $1', [id]);
    if (!before) return false;
    const after = await queryOne<Issue>(
      `update issues set title = $2, body = $3, status = $4, priority = $5, notes = $6, business_id = $7, updated_at = now(),
         closed_at = case when $4 = 'closed' then coalesce(closed_at, now()) else null end where id = $1 returning *`,
      [id, v.title, v.body, v.status, v.priority, v.notes, v.business_id]);
    await audit(user, 'issue_update', 'issue', id, before, after);
    return true;
  });
}

export async function setIssueStatus(user: SessionUser, id: string, status: string) {
  assertAdmin(user);
  if (!isId(id) || !(ISSUE_STATUSES as readonly string[]).includes(status)) return false;
  return needsSchema(async () => {
    const before = await queryOne<{ status: string }>('select status from issues where id = $1', [id]);
    if (!before) return false;
    await query(`update issues set status = $2, updated_at = now(), closed_at = case when $2 = 'closed' then coalesce(closed_at, now()) else null end where id = $1`, [id, status]);
    await audit(user, 'issue_status', 'issue', id, before, { status });
    return true;
  });
}

export async function deleteIssue(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return false;
  return needsSchema(async () => {
    const before = await queryOne<Issue>('delete from issues where id = $1 returning *', [id]);
    if (before) await audit(user, 'issue_delete', 'issue', id, before, null);
    return Boolean(before);
  });
}
