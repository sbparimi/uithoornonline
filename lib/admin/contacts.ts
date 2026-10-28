import 'server-only';
import { query, queryOne } from '../db';
import type { SessionUser } from '../auth/session';
import { assertAdmin, audit, isId, like, needsSchema, optional, paged, paging } from './core';

// Contacts = contact-form messages (contact_messages) + inbound email (inbound_emails, via Resend).
export type ContactKind = 'form' | 'email';
export type ContactRow = { kind: ContactKind; id: string; name: string; email: string; subject: string; body: string; status: string; created_at: string; replies: number };
export type ContactFilter = { q?: string; status?: string; source?: string; page?: string };

export async function listContacts(user: SessionUser, f: ContactFilter, all = false) {
  assertAdmin(user);
  const p = paging(f.page, all ? 100000 : 25);
  const q = (f.q ?? '').trim().slice(0, 100);
  const source = f.source === 'form' || f.source === 'email' ? f.source : '';
  const params = [q, like(q), f.status ?? '', source];
  const formSql = `select 'form' as kind, c.id, c.name, c.email::text as email, c.subject, c.body, c.status, c.created_at,
      %REPLIES_FORM% as replies from contact_messages c
      where ($1 = '' or c.name ilike $2 or c.email::text ilike $2 or c.subject ilike $2 or c.body ilike $2) and ($3 = '' or c.status = $3) and ($4 = '' or $4 = 'form')`;
  const emailSql = `select 'email' as kind, e.id, e.from_address as name, e.from_address as email, e.subject, e.text_body as body, e.status, e.received_at as created_at,
      (select count(*)::int from contact_replies r where r.inbound_email_id = e.id) as replies from inbound_emails e
      where ($1 = '' or e.from_address ilike $2 or e.subject ilike $2 or e.text_body ilike $2) and ($3 = '' or e.status = $3) and ($4 = '' or $4 = 'email')`;
  const tail = `order by created_at desc limit ${p.size} offset ${p.offset}`;
  const full = `select x.*, count(*) over() as _total from (${formSql.replace('%REPLIES_FORM%', '(select count(*)::int from contact_replies r where r.contact_message_id = c.id)')} union all ${emailSql}) x ${tail}`;
  const legacy = `select x.*, count(*) over() as _total from (${formSql.replace('%REPLIES_FORM%', '0')}) x ${tail}`;
  const rows = await optional(() => query<ContactRow & { _total: number }>(full, params), null) ?? await query<ContactRow & { _total: number }>(legacy, params);
  return paged<ContactRow>(rows, p);
}

export async function getContact(user: SessionUser, kind: string, id: string) {
  assertAdmin(user);
  if (!isId(id)) return null;
  if (kind === 'email') {
    const row = await optional(() => queryOne<ContactRow & { to_addresses: string; html_body: string | null }>(
      `select 'email' as kind, id, from_address as name, from_address as email, subject, text_body as body, status, received_at as created_at, to_addresses, html_body, 0 as replies from inbound_emails where id = $1`, [id]), null);
    if (!row) return null;
    const replies = await optional(() => query<{ id: string; subject: string; body: string; created_at: string; email_status: string }>('select id, subject, body, created_at, email_status from contact_replies where inbound_email_id = $1 order by created_at', [id]), []);
    return { contact: row, replies };
  }
  const row = await queryOne<ContactRow>(`select 'form' as kind, id, name, email::text as email, subject, body, status, created_at, 0 as replies from contact_messages where id = $1`, [id]);
  if (!row) return null;
  const replies = await optional(() => query<{ id: string; subject: string; body: string; created_at: string; email_status: string }>('select id, subject, body, created_at, email_status from contact_replies where contact_message_id = $1 order by created_at', [id]), []);
  return { contact: row, replies };
}

const table = (kind: string) => (kind === 'email' ? 'inbound_emails' : 'contact_messages');

export async function setContactStatus(user: SessionUser, kind: string, id: string, status: string) {
  assertAdmin(user);
  if (!isId(id) || !['new', 'handled', 'spam'].includes(status)) return false;
  const run = async () => {
    const before = await queryOne<{ status: string }>(`select status from ${table(kind)} where id = $1`, [id]);
    if (!before) return false;
    await query(`update ${table(kind)} set status = $2 where id = $1`, [id, status]);
    await audit(user, 'contact_status', kind === 'email' ? 'inbound_email' : 'contact_message', id, before, { status });
    return true;
  };
  return kind === 'email' ? needsSchema(run) : run();
}

export async function deleteContact(user: SessionUser, kind: string, id: string) {
  assertAdmin(user);
  if (!isId(id)) return false;
  const run = async () => {
    const before = await queryOne<Record<string, unknown>>(`delete from ${table(kind)} where id = $1 returning *`, [id]);
    if (!before) return false;
    await audit(user, 'contact_delete', kind === 'email' ? 'inbound_email' : 'contact_message', id, before, null);
    return true;
  };
  return kind === 'email' ? needsSchema(run) : run();
}

export async function recordReply(user: SessionUser, kind: string, id: string, to: string, subject: string, body: string, emailStatus: string) {
  assertAdmin(user);
  await needsSchema(() => query(
    'insert into contact_replies(contact_message_id, inbound_email_id, to_address, subject, body, email_status, sent_by) values ($1,$2,$3,$4,$5,$6,$7)',
    [kind === 'form' ? id : null, kind === 'email' ? id : null, to, subject.slice(0, 300), body.slice(0, 10000), emailStatus, user.id]));
  if (emailStatus === 'sent' || emailStatus === 'skipped') await query(`update ${table(kind)} set status = 'handled' where id = $1 and status = 'new'`, [id]);
  await audit(user, 'contact_reply', kind === 'email' ? 'inbound_email' : 'contact_message', id, null, { to, subject, email_status: emailStatus });
}

export async function listSubmissions(user: SessionUser) {
  assertAdmin(user);
  return query<{ id: string; kind: string; name: string; email: string; title: string; description: string; status: string; created_at: string }>(
    'select id, kind, name, email, title, description, status, created_at from community_submissions order by created_at desc limit 50');
}

export async function setSubmissionStatus(user: SessionUser, id: string, status: string) {
  assertAdmin(user);
  if (!isId(id) || !['pending', 'reviewed', 'rejected', 'published'].includes(status)) return false;
  const before = await queryOne<{ status: string }>('select status from community_submissions where id = $1', [id]);
  if (!before) return false;
  await query('update community_submissions set status = $2, updated_at = now() where id = $1', [id, status]);
  await audit(user, 'submission_status', 'submission', id, before, { status });
  return true;
}

export async function deleteSubmission(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return false;
  const before = await queryOne<Record<string, unknown>>('delete from community_submissions where id = $1 returning *', [id]);
  if (before) await audit(user, 'submission_delete', 'submission', id, before, null);
  return Boolean(before);
}

/** Stores an inbound email (called by the signature-verified webhook). Idempotent on the provider id. */
export async function storeInboundEmail(e: { providerId: string; from: string; to: string; subject: string; text: string; html: string | null }) {
  return queryOne<{ id: string; inserted: boolean }>(
    `insert into inbound_emails(provider_id, from_address, to_addresses, subject, text_body, html_body) values ($1,$2,$3,$4,$5,$6)
     on conflict (provider_id) do update set provider_id = excluded.provider_id returning id, (xmax = 0) as inserted`,
    [e.providerId.slice(0, 200), e.from.slice(0, 320), e.to.slice(0, 2000), e.subject.slice(0, 500), e.text.slice(0, 100000), e.html ? e.html.slice(0, 300000) : null]);
}
