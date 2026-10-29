import 'server-only';
import { query, queryOne } from '../db';
import type { Role, SessionUser } from '../auth/session';
import { assertAdmin, audit, isId, like, paged, paging } from './core';

export type UserRow = { id: string; email: string; full_name: string; phone: string | null; role: Role; locale: string; disabled_at: string | null; last_login_at: string | null; created_at: string; has_password: boolean; businesses: number; requests: number };

export type UserFilter = { q?: string; role?: string; status?: string; page?: string };

export async function listUsers(user: SessionUser, f: UserFilter, all = false) {
  assertAdmin(user);
  const p = paging(f.page, all ? 100000 : 25);
  const q = (f.q ?? '').trim().slice(0, 100);
  const rows = await query<UserRow & { _total: number }>(
    `select u.id, u.email, u.full_name, u.phone, u.role, u.locale, u.disabled_at, u.last_login_at, u.created_at, (u.password_hash is not null) as has_password,
            (select count(*)::int from businesses b where b.owner_id = u.id) as businesses,
            (select count(*)::int from service_requests r where r.customer_id = u.id) as requests,
            count(*) over() as _total
       from users u
      where ($1 = '' or u.email::text ilike $2 or u.full_name ilike $2 or coalesce(u.phone, '') ilike $2)
        and ($3 = '' or u.role::text = $3)
        and ($4 = '' or ($4 = 'suspended' and u.disabled_at is not null) or ($4 = 'active' and u.disabled_at is null) or ($4 = 'nopassword' and u.password_hash is null))
      order by u.created_at desc limit ${p.size} offset ${p.offset}`, [q, like(q), f.role ?? '', f.status ?? '']);
  return paged<UserRow>(rows, p);
}

export async function getUser(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return null;
  const u = await queryOne<UserRow & { terms_accepted_at: string | null; email_verified_at: string | null }>(
    `select u.id, u.email, u.full_name, u.phone, u.role, u.locale, u.disabled_at, u.last_login_at, u.created_at, u.terms_accepted_at, u.email_verified_at,
            (u.password_hash is not null) as has_password, 0 as businesses, 0 as requests from users u where u.id = $1`, [id]);
  if (!u) return null;
  const businesses = await query<{ id: string; name: string; moderation_status: string }>('select id, name, moderation_status from businesses where owner_id = $1 order by created_at', [id]);
  const requests = await query<{ id: string; category: string; status: string; created_at: string }>('select id, category, status, created_at from service_requests where customer_id = $1 order by created_at desc limit 20', [id]);
  const sessions = await queryOne<{ n: number }>('select count(*)::int as n from sessions where user_id = $1 and expires_at > now()', [id]);
  return { user: u, businesses, requests, activeSessions: sessions?.n ?? 0 };
}

const ROLES: Role[] = ['customer', 'provider', 'admin'];

export type UserInput = { email: string; full_name: string; phone: string | null; role: Role; locale: 'nl' | 'en' };
export function cleanUser(body: Record<string, unknown>): { value: UserInput; error: string | null } {
  const s = (k: string, max: number) => String(body[k] ?? '').trim().slice(0, max);
  const role = s('role', 20) as Role;
  const value: UserInput = { email: s('email', 254).toLowerCase(), full_name: s('full_name', 120), phone: s('phone', 40) || null, role: ROLES.includes(role) ? role : 'customer', locale: body.locale === 'en' ? 'en' : 'nl' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.email)) return { value, error: 'invalid_email' };
  return { value, error: null };
}

/** Admin-created account: no password; the person sets one through the reset email. */
export async function createUser(user: SessionUser, v: UserInput) {
  assertAdmin(user);
  const row = await queryOne<{ id: string }>(
    `insert into users(email, full_name, phone, role, locale) values ($1,$2,$3,$4,$5) on conflict (email) do nothing returning id`, [v.email, v.full_name, v.phone, v.role, v.locale]);
  if (!row) return { error: 'email_exists' as const };
  await audit(user, 'user_create', 'user', row.id, null, v);
  return { id: row.id };
}

export async function updateUser(user: SessionUser, id: string, v: UserInput) {
  assertAdmin(user);
  if (!isId(id)) return { error: 'not_found' as const };
  const before = await queryOne<Record<string, unknown>>('select id, email, full_name, phone, role, locale, disabled_at from users where id = $1', [id]);
  if (!before) return { error: 'not_found' as const };
  if (id === user.id && v.role !== 'admin') return { error: 'cannot_demote_self' as const };
  const clash = await queryOne('select 1 from users where email = $1 and id <> $2', [v.email, id]);
  if (clash) return { error: 'email_exists' as const };
  const after = await queryOne<Record<string, unknown>>(
    'update users set email = $2, full_name = $3, phone = $4, role = $5, locale = $6, updated_at = now() where id = $1 returning id, email, full_name, phone, role, locale, disabled_at',
    [id, v.email, v.full_name, v.phone, v.role, v.locale]);
  // A changed email or role ends the account's sessions, so the new state applies at once.
  if (before.email !== v.email || before.role !== v.role) await query('delete from sessions where user_id = $1 and user_id <> $2', [id, user.id]);
  await audit(user, 'user_update', 'user', id, before, after);
  return { ok: true };
}

export async function setRole(user: SessionUser, id: string, role: Role) {
  assertAdmin(user);
  if (!isId(id) || !ROLES.includes(role)) return { error: 'invalid_request' as const };
  if (id === user.id && role !== 'admin') return { error: 'cannot_demote_self' as const };
  const before = await queryOne<{ role: Role }>('select role from users where id = $1', [id]);
  if (!before) return { error: 'not_found' as const };
  await query('update users set role = $2, updated_at = now() where id = $1', [id, role]);
  if (before.role !== role) await query('delete from sessions where user_id = $1', [id]);
  await audit(user, 'user_role', 'user', id, before, { role });
  return { ok: true };
}

export async function setSuspended(user: SessionUser, id: string, suspended: boolean) {
  assertAdmin(user);
  if (!isId(id)) return { error: 'invalid_request' as const };
  if (id === user.id) return { error: 'cannot_suspend_self' as const };
  const before = await queryOne<{ disabled_at: string | null }>('select disabled_at from users where id = $1', [id]);
  if (!before) return { error: 'not_found' as const };
  const after = await queryOne<{ disabled_at: string | null }>(`update users set disabled_at = ${suspended ? 'coalesce(disabled_at, now())' : 'null'}, updated_at = now() where id = $1 returning disabled_at`, [id]);
  if (suspended) await query('delete from sessions where user_id = $1', [id]);
  await audit(user, suspended ? 'user_suspend' : 'user_unsuspend', 'user', id, before, after);
  return { ok: true };
}

/** Deletes the account and everything that cascades from it (their businesses, requests, conversations). */
export async function deleteUser(user: SessionUser, id: string, confirmEmail: string) {
  assertAdmin(user);
  if (!isId(id)) return { error: 'invalid_request' as const };
  if (id === user.id) return { error: 'cannot_delete_self' as const };
  const before = await queryOne<Record<string, unknown> & { email: string }>('select id, email, full_name, phone, role, created_at from users where id = $1', [id]);
  if (!before) return { error: 'not_found' as const };
  if (confirmEmail.trim().toLowerCase() !== String(before.email).toLowerCase()) return { error: 'confirm_mismatch' as const };
  const owned = await query<{ id: string; name: string }>('select id, name from businesses where owner_id = $1', [id]);
  await query('delete from users where id = $1', [id]);
  await audit(user, 'user_delete', 'user', id, before, null, { deleted_businesses: owned });
  return { ok: true };
}

export async function userForReset(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return null;
  return queryOne<{ id: string; email: string; locale: 'nl' | 'en'; disabled_at: string | null }>('select id, email, locale, disabled_at from users where id = $1', [id]);
}
