#!/usr/bin/env node
// Checks lib/push/webpush.ts encryption against the RFC 8291 Appendix A test vector (same algorithm, copied).
// Usage: node scripts/push-selftest.mjs  -> prints true
import { createCipheriv, createECDH, createHmac, randomBytes } from 'node:crypto';
const b64u = (b) => Buffer.from(b).toString('base64url');
const fromB64u = (s) => Buffer.from(s.replace(/=+$/, ''), 'base64url');

function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
export const vapidPublicKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function hmac(key, data) { return createHmac('sha256', key).update(data).digest(); }

/** RFC 8291 §3.4 + RFC 8188: one record, padding delimiter 0x02. `salt`/`asKeys` only for tests. */
function encryptPayload(payload, uaPublicB64, authSecretB64, test) {
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


const out = encryptPayload(Buffer.from('When I grow up, I want to be a watermelon'),
 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4','BTBZMqHH6r4Tts7J_aSIgg',
 { salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw','base64url'), asPrivate: Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw','base64url') });
const exp='DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
console.log(out.toString('base64url') === exp);
if (out.toString('base64url') !== exp) process.exit(1);
