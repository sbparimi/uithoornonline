import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Signed, login-free tokens for the one-tap accept link (per business + request), the customer's
// live status page (per request) and the voice-call keypress webhook. HMAC-SHA256 over the payload;
// nothing is stored. Secret: ALERT_TOKEN_SECRET, falling back to CRON_SECRET.
type Purpose = 'accept' | 'status' | 'voice' | 'photo' | 'review';

function secret() {
  const s = process.env.ALERT_TOKEN_SECRET || process.env.CRON_SECRET;
  if (!s) throw new Error('ALERT_TOKEN_SECRET (or CRON_SECRET) is not configured');
  return s;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const sig = (data: string) => createHmac('sha256', secret()).update(data).digest().subarray(0, 18);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `ids` are uuids; `days` how long the token is valid. */
export function signToken(purpose: Purpose, ids: string[], days: number) {
  const exp = Math.floor(Date.now() / 1000) + Math.round(days * 86400);
  const payload = `${purpose}.${ids.join('.')}.${exp}`;
  return `${b64(payload)}.${b64(sig(payload))}`;
}

export function verifyToken(purpose: Purpose, token: string | null | undefined): string[] | null {
  if (!token || token.length > 400) return null;
  const [p, s] = String(token).split('.');
  if (!p || !s) return null;
  let payload: string;
  try { payload = Buffer.from(p, 'base64url').toString('utf8'); } catch { return null; }
  let expected: Buffer; let given: Buffer;
  try { expected = sig(payload); given = Buffer.from(s, 'base64url'); } catch { return null; }
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const parts = payload.split('.');
  if (parts[0] !== purpose || parts.length < 3) return null;
  const exp = Number(parts[parts.length - 1]);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const ids = parts.slice(1, -1);
  return ids.every((id) => UUID.test(id)) ? ids : null;
}
