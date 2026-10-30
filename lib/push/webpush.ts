import 'server-only';
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto';

// Web Push without dependencies: VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291/8188).
// Free: the browser vendors' push services deliver it. Keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY (raw P-256
// public key, base64url) + VAPID_PRIVATE_KEY (the private scalar d, base64url), VAPID_SUBJECT
// (mailto: or https: contact). Unset = push switched off (nothing is shown or sent).

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url');
const fromB64u = (s: string) => Buffer.from(s.replace(/=+$/, ''), 'base64url');

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
export const vapidPublicKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function hmac(key: Buffer, data: Buffer) { return createHmac('sha256', key).update(data).digest(); }

/** RFC 8291 §3.4 + RFC 8188: one record, padding delimiter 0x02. `salt`/`asKeys` only for tests. */
export function encryptPayload(payload: Buffer, uaPublicB64: string, authSecretB64: string, test?: { salt: Buffer; asPrivate: Buffer }) {
  const uaPublic = fromB64u(uaPublicB64);
  const authSecret = fromB64u(authSecretB64);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('invalid_subscription_keys');
  const ecdh = createECDH('prime256v1');
  if (test) ecdh.setPrivateKey(test.asPrivate); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = test?.salt ?? randomBytes(16);
  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

function vapidJwt(endpoint: string) {
  const pub = fromB64u(vapidPublicKey());
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: process.env.VAPID_PRIVATE_KEY!, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  const header = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || 'mailto:reachparimi@gmail.com' })));
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${claims}.${b64u(signature)}`;
}

export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url: string; tag?: string };
export type PushResult = { ok: boolean; status: number; gone: boolean; error: string | null };

const ALLOWED_PUSH_HOSTS = /(^|\.)(googleapis\.com|mozilla\.com|mozaws\.net|windows\.com|notify\.windows\.com|push\.apple\.com)$/;

export function isAllowedEndpoint(endpoint: string) {
  try { const u = new URL(endpoint); return u.protocol === 'https:' && ALLOWED_PUSH_HOSTS.test(u.hostname); } catch { return false; }
}

export async function sendPush(sub: PushSubscriptionKeys, msg: PushMessage, ttlSeconds = 6 * 3600): Promise<PushResult> {
  if (!pushConfigured()) return { ok: false, status: 0, gone: false, error: 'push_not_configured' };
  if (!isAllowedEndpoint(sub.endpoint)) return { ok: false, status: 0, gone: true, error: 'endpoint_not_allowed' };
  try {
    const body = encryptPayload(Buffer.from(JSON.stringify(msg)), sub.p256dh, sub.auth);
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttlSeconds), Urgency: 'high', ...(msg.tag ? { Topic: msg.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}), Authorization: `vapid t=${vapidJwt(sub.endpoint)}, k=${vapidPublicKey()}` },
      body, signal: AbortSignal.timeout(10_000),
    });
    const gone = res.status === 404 || res.status === 410;
    return { ok: res.status >= 200 && res.status < 300, status: res.status, gone, error: res.ok ? null : (await res.text().catch(() => '')).slice(0, 300) || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: e instanceof Error ? e.message.slice(0, 300) : 'push_failed' };
  }
}
