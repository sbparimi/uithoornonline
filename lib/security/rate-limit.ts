import 'server-only';
import { queryOne } from '../db';
import { sha256 } from '../auth/session';

export type Limit = { limit: number; windowSeconds: number };

// Named limits for every public write path.
export const LIMITS = {
  signupIp: { limit: 5, windowSeconds: 3600 },
  loginIp: { limit: 20, windowSeconds: 900 },
  loginEmail: { limit: 8, windowSeconds: 900 },
  emailLink: { limit: 4, windowSeconds: 3600 },
  requestUser: { limit: 5, windowSeconds: 3600 },
  requestIp: { limit: 10, windowSeconds: 3600 },
  submissionIp: { limit: 5, windowSeconds: 3600 },
  contactIp: { limit: 5, windowSeconds: 3600 },
  messageUser: { limit: 60, windowSeconds: 3600 },
  reviewUser: { limit: 10, windowSeconds: 86400 },
  analyticsIp: { limit: 120, windowSeconds: 60 },
  accountAction: { limit: 10, windowSeconds: 3600 },
  resetIp: { limit: 10, windowSeconds: 3600 },
  resetEmail: { limit: 4, windowSeconds: 3600 },
  resetConfirmIp: { limit: 20, windowSeconds: 3600 },
} satisfies Record<string, Limit>;

export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = (forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip')) || 'unknown';
  return ip.trim().slice(0, 64);
}

/**
 * Fixed-window counter stored in Postgres so it holds across serverless instances.
 * Keys are hashed, so no raw IP address or email is stored.
 */
export async function rateLimit(bucket: string, subject: string, { limit, windowSeconds }: Limit) {
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const key = `${bucket}:${sha256(subject).slice(0, 32)}`;
  const row = await queryOne<{ count: number }>(
    `insert into rate_limits(key, window_start, count) values ($1, $2, 1)
     on conflict (key, window_start) do update set count = rate_limits.count + 1
     returning count`,
    [key, windowStart],
  );
  if (Math.random() < 0.02) queryOne("delete from rate_limits where window_start < now() - interval '2 days'").catch(() => undefined);
  const count = row?.count ?? 1;
  const retryAfter = Math.max(1, Math.ceil((windowStart.getTime() + windowSeconds * 1000 - Date.now()) / 1000));
  return { ok: count <= limit, count, retryAfter };
}
