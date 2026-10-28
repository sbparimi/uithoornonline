import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Verifies a Resend webhook (Svix scheme): HMAC-SHA256 over "<id>.<timestamp>.<raw body>" with the
// base64 secret after the "whsec_" prefix; header "v1,<base64 sig>" (space-separated list). 5-minute tolerance.
export function verifyWebhook(rawBody: string, headers: Headers, secret: string | undefined, nowMs = Date.now()) {
  if (!secret) return { ok: false as const, reason: 'no_secret' };
  const id = headers.get('svix-id') || headers.get('webhook-id');
  const timestamp = headers.get('svix-timestamp') || headers.get('webhook-timestamp');
  const signature = headers.get('svix-signature') || headers.get('webhook-signature');
  if (!id || !timestamp || !signature) return { ok: false as const, reason: 'missing_headers' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > 300) return { ok: false as const, reason: 'stale_timestamp' };
  let key: Buffer;
  try { key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64'); } catch { return { ok: false as const, reason: 'bad_secret' }; }
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();
  for (const part of signature.split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    let given: Buffer;
    try { given = Buffer.from(sig, 'base64'); } catch { continue; }
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true as const, id };
  }
  return { ok: false as const, reason: 'bad_signature' };
}

/** Test helper: signs a body the way Resend/Svix does. */
export function signWebhook(rawBody: string, secret: string, id: string, timestamp: number) {
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  return `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64')}`;
}
