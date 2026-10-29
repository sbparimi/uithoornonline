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

/** Consumes a token only if it has the expected purpose (single use, not expired). */
export async function consumeAuthTokenFor(token: string, purpose: TokenPurpose) {
  if (!token || token.length > 200) return null;
  return queryOne<{ email: string }>(
    'update auth_tokens set used_at = now() where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now() returning email',
    [sha256(token), purpose],
  );
}

/** Invalidates every outstanding token of a purpose for an email (e.g. after a successful reset). */
export async function revokeAuthTokens(email: string, purpose: TokenPurpose) {
  await query('update auth_tokens set used_at = now() where email = $1 and purpose = $2 and used_at is null', [email.toLowerCase(), purpose]);
}

export const RESET_TOKEN_MINUTES = 60;
