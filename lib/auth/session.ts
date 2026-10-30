import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { query, queryOne, isDbConfigured, DbUnavailableError } from '../db';

export type Role = 'customer' | 'provider' | 'admin';
export type SessionUser = { id: string; email: string; fullName: string; phone: string | null; role: Role; emailVerified: boolean; authMethod: 'password' | 'email_link'; sessionAgeSeconds: number };

export const SESSION_COOKIE = 'uo_session';
const SESSION_DAYS = 30;

export class AuthError extends Error {
  constructor(public code: string, public status: number) { super(code); this.name = 'AuthError'; }
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function cookieSecure() {
  return process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== '1';
}

/**
 * Creates a server-side session and sets the httpOnly cookie. Call from route handlers only.
 * Returns the raw token so the mobile app (which cannot rely on cookies) can send it back as
 * `Authorization: Bearer <token>`; the database only ever stores its sha256.
 */
export async function createSession(userId: string, authMethod: 'password' | 'email_link' = 'password'): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await query('insert into sessions(id, user_id, auth_method, expires_at) values ($1, $2, $3, $4)', [sha256(token), userId, authMethod, expires]);
  await query('update users set last_login_at = now() where id = $1', [userId]);
  // Opportunistic clean-up of expired sessions/tokens (cheap, indexed).
  query("delete from sessions where expires_at < now() - interval '1 day'").catch(() => undefined);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure: cookieSecure(), sameSite: 'lax', path: '/', expires });
  return token;
}

/** True when the request comes from the Uithoorn.online mobile app (it asks for the token in the body). */
export function isMobileClient(request: Request) {
  return request.headers.get('x-uo-client') === 'mobile';
}

/** The session token from the cookie (web) or the Authorization header (mobile app). */
async function requestToken(): Promise<string | undefined> {
  const store = await cookies();
  const fromCookie = store.get(SESSION_COOKIE)?.value;
  if (fromCookie) return fromCookie;
  const auth = (await headers()).get('authorization') || '';
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(auth.trim());
  return match ? match[1] : undefined;
}

export async function destroySession() {
  const store = await cookies();
  const token = await requestToken();
  if (token && isDbConfigured()) await query('delete from sessions where id = $1', [sha256(token)]).catch(() => undefined);
  store.set(SESSION_COOKIE, '', { httpOnly: true, secure: cookieSecure(), sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function destroyAllSessions(userId: string) {
  await query('delete from sessions where user_id = $1', [userId]);
}

type Row = { id: string; email: string; full_name: string; phone: string | null; role: Role; email_verified_at: string | null; auth_method: 'password' | 'email_link'; age: number };

/** The signed-in user for this request, or null. Never throws for anonymous visitors or a DB outage. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await requestToken();
  if (!token || !isDbConfigured()) return null;
  try {
    const row = await queryOne<Row>(
      `select u.id, u.email, u.full_name, u.phone, u.role, u.email_verified_at, s.auth_method,
              extract(epoch from now() - s.created_at)::int as age
         from sessions s join users u on u.id = s.user_id
        where s.id = $1 and s.expires_at > now() and u.disabled_at is null`,
      [sha256(token)],
    );
    if (!row) return null;
    return { id: row.id, email: row.email, fullName: row.full_name, phone: row.phone, role: row.role, emailVerified: Boolean(row.email_verified_at), authMethod: row.auth_method, sessionAgeSeconds: row.age };
  } catch (error) {
    if (error instanceof DbUnavailableError) return null;
    throw error;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('login_required', 401);
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthError(roles.includes('admin') && roles.length === 1 ? 'admin_required' : 'forbidden', 403);
  return user;
}
