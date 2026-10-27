import 'server-only';
import { query, queryOne } from '../db';
import type { Role, SessionUser } from '../auth/session';

export type UserRow = { id: string; email: string; password_hash: string | null; full_name: string; role: Role; disabled_at: string | null; locale: 'nl' | 'en' };

export function normalizeEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

export async function findUserByEmail(email: string) {
  return queryOne<UserRow>('select id, email, password_hash, full_name, role, disabled_at, locale from users where email = $1', [email]);
}

/** Self-service signup can only create residents ('customer') or businesses ('provider'). */
export async function createUser(input: { email: string; passwordHash: string | null; fullName: string; phone: string | null; role: 'customer' | 'provider'; locale: 'nl' | 'en'; emailVerified?: boolean }) {
  const role = input.role === 'provider' ? 'provider' : 'customer';
  return queryOne<{ id: string }>(
    `insert into users(email, password_hash, full_name, phone, role, locale, terms_accepted_at, email_verified_at)
     values ($1,$2,$3,$4,$5,$6, now(), case when $7 then now() else null end) on conflict (email) do nothing returning id`,
    [input.email, input.passwordHash, input.fullName, input.phone, role, input.locale, Boolean(input.emailVerified)]);
}

/** Profile fields a user may change themselves. `role` is never accepted here. */
export async function updateOwnProfile(user: SessionUser, input: { fullName?: string; phone?: string | null; locale?: 'nl' | 'en' }) {
  const sets: string[] = []; const params: unknown[] = [];
  if (input.fullName !== undefined) { params.push(input.fullName.slice(0, 120)); sets.push(`full_name = $${params.length}`); }
  if (input.phone !== undefined) { params.push(input.phone ? input.phone.slice(0, 40) : null); sets.push(`phone = $${params.length}`); }
  if (input.locale !== undefined) { params.push(input.locale === 'en' ? 'en' : 'nl'); sets.push(`locale = $${params.length}`); }
  if (!sets.length) return;
  params.push(user.id);
  await query(`update users set ${sets.join(', ')} where id = $${params.length}`, params);
}

export async function setPassword(userId: string, passwordHash: string) {
  await query('update users set password_hash = $2 where id = $1', [userId, passwordHash]);
}

export async function markEmailVerified(userId: string) {
  await query('update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1', [userId]);
}
