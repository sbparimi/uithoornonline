import 'server-only';
import { randomBytes } from 'node:crypto';
import { query, queryOne } from '../db';
import { sha256 } from './session';

export type TokenPurpose = 'login' | 'verify' | 'reset';

export async function createAuthToken(email: string, purpose: TokenPurpose, minutes = 20) {
  const token = randomBytes(32).toString('base64url');
  await query('insert into auth_tokens(token_hash, email, purpose, expires_at) values ($1, $2, $3, now() + make_interval(mins => $4))', [sha256(token), email.toLowerCase(), purpose, minutes]);
  query("delete from auth_tokens where expires_at < now() - interval '1 day'").catch(() => undefined);
  return token;
}

/** Marks the token used and returns its email, or null if unknown / expired / already used. */
export async function consumeAuthToken(token: string) {
  if (!token || token.length > 200) return null;
  return queryOne<{ email: string; purpose: TokenPurpose }>(
    'update auth_tokens set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning email, purpose',
    [sha256(token)],
  );
}
