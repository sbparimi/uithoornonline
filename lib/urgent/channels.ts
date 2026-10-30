import 'server-only';
import { phoneRedirect, smsAlertsEnabled, voiceAlertsEnabled, whatsappAlertsEnabled } from './flags';

// Provider-agnostic SMS / WhatsApp / voice adapters. Each send returns a result instead of throwing,
// and does nothing ("disabled") unless its feature flag is on AND its credentials exist.
//
// SMS + voice (Twilio-style REST):  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (+31…)
//   TWILIO_API_BASE may point at another Twilio-compatible API or a mock (default https://api.twilio.com).
// WhatsApp, either:
//   WHATSAPP_PROVIDER=twilio  + TWILIO_WHATSAPP_FROM (e.g. whatsapp:+3197…) — same Twilio account
//   WHATSAPP_PROVIDER=meta    + WHATSAPP_CLOUD_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ALERT_TEMPLATE
//                               (an approved template with one {{1}} body parameter), WHATSAPP_TEMPLATE_LANG (default nl)

export type ChannelResult = { status: 'sent' | 'disabled' | 'failed' | 'skipped'; id: string | null; error: string | null; to: string | null };

const twilioReady = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);

export function channelReadiness() {
  const wa = (process.env.WHATSAPP_PROVIDER || 'twilio').toLowerCase();
  const waReady = wa === 'meta'
    ? Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ALERT_TEMPLATE)
    : Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
  return {
    sms: { flag: smsAlertsEnabled(), credentials: twilioReady() },
    whatsapp: { flag: whatsappAlertsEnabled(), credentials: waReady, provider: wa },
    voice: { flag: voiceAlertsEnabled(), credentials: twilioReady() },
  };
}

/** "06 1234 5678" → "+31612345678"; null when it does not look like a phone number. */
export function e164(raw: string | null | undefined): string | null {
  let d = String(raw ?? '').trim();
  if (!d) return null;
  const plus = d.startsWith('+');
  d = d.replace(/\(0\)/g, '').replace(/\D/g, '');
  if (!plus) { if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = `31${d.slice(1)}`; }
  return d.length >= 9 && d.length <= 15 ? `+${d}` : null;
}

function target(raw: string | null | undefined) {
  const redirect = phoneRedirect();
  return e164(redirect || raw);
}

async function twilio(path: string, form: Record<string, string>): Promise<{ id: string | null; error: string | null }> {
  const sid = process.env.TWILIO_ACCOUNT_SID!; const token = process.env.TWILIO_AUTH_TOKEN!;
  const base = (process.env.TWILIO_API_BASE || 'https://api.twilio.com').replace(/\/$/, '');
  try {
    const r = await fetch(`${base}/2010-04-01/Accounts/${encodeURIComponent(sid)}/${path}`, {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { id: null, error: `${r.status} ${String(j?.message ?? '').slice(0, 300)}` };
    return { id: String(j?.sid ?? ''), error: null };
  } catch (e) { return { id: null, error: e instanceof Error ? e.message : String(e) }; }
}

export async function sendSms(rawTo: string | null | undefined, body: string): Promise<ChannelResult> {
  const to = target(rawTo);
  if (!smsAlertsEnabled() || !twilioReady()) return { status: 'disabled', id: null, error: !smsAlertsEnabled() ? 'JOB_ALERTS_SMS_ENABLED off' : 'Twilio not configured', to };
  if (!to) return { status: 'skipped', id: null, error: 'no valid mobile number', to: null };
  const r = await twilio('Messages.json', { To: to, From: process.env.TWILIO_FROM_NUMBER!, Body: body.slice(0, 1500) });
  return { status: r.error ? 'failed' : 'sent', id: r.id, error: r.error, to };
}

export async function sendWhatsApp(rawTo: string | null | undefined, body: string): Promise<ChannelResult> {
  const to = target(rawTo);
  const ready = channelReadiness().whatsapp;
  if (!ready.flag || !ready.credentials) return { status: 'disabled', id: null, error: !ready.flag ? 'JOB_ALERTS_WHATSAPP_ENABLED off' : 'WhatsApp not configured', to };
  if (!to) return { status: 'skipped', id: null, error: 'no valid mobile number', to: null };
  if (ready.provider === 'meta') {
    try {
      const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID!)}/messages`, {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'template', template: { name: process.env.WHATSAPP_ALERT_TEMPLATE, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'nl' }, components: [{ type: 'body', parameters: [{ type: 'text', text: body.replace(/\s+/g, ' ').slice(0, 900) }] }] } }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { status: 'failed', id: null, error: `${r.status} ${String(j?.error?.message ?? '').slice(0, 300)}`, to };
      return { status: 'sent', id: String(j?.messages?.[0]?.id ?? ''), error: null, to };
    } catch (e) { return { status: 'failed', id: null, error: e instanceof Error ? e.message : String(e), to }; }
  }
  const r = await twilio('Messages.json', { To: `whatsapp:${to}`, From: process.env.TWILIO_WHATSAPP_FROM!, Body: body.slice(0, 1500) });
  return { status: r.error ? 'failed' : 'sent', id: r.id, error: r.error, to };
}

function xml(s: string) { return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] as string)); }

/** Automated call: reads `say` (Dutch voice), "press 1 to accept" posts the keypress to `gatherUrl`. */
export async function placeCall(rawTo: string | null | undefined, say: string, gatherUrl: string): Promise<ChannelResult> {
  const to = target(rawTo);
  if (!voiceAlertsEnabled() || !twilioReady()) return { status: 'disabled', id: null, error: !voiceAlertsEnabled() ? 'JOB_ALERTS_VOICE_ENABLED off' : 'Twilio not configured', to };
  if (!to) return { status: 'skipped', id: null, error: 'no valid phone number', to: null };
  const twiml = `<Response><Gather numDigits="1" timeout="8" action="${xml(gatherUrl)}" method="POST"><Say language="nl-NL">${xml(say)}</Say><Pause length="1"/><Say language="nl-NL">${xml(say)}</Say></Gather><Say language="nl-NL">Geen keuze ontvangen. U krijgt ook een sms met de link. Tot ziens.</Say></Response>`;
  const r = await twilio('Calls.json', { To: to, From: process.env.TWILIO_FROM_NUMBER!, Twiml: twiml, Timeout: '25' });
  return { status: r.error ? 'failed' : 'sent', id: r.id, error: r.error, to };
}
