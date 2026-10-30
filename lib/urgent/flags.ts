import 'server-only';

// Feature flags for 24/7 urgent handling (docs/URGENT_HANDLING.md). Everything is OFF unless the
// env var is exactly "1", so production is unchanged until the owner switches a part on.
const on = (name: string) => process.env[name] === '1';

/** The chat-style "Hulp nodig?" intake at /hulp (and the link to it on /request). */
export const intakeEnabled = () => on('URGENT_INTAKE_ENABLED');
/** Instant job alerts by email with a one-tap accept link (replaces the plain "new lead" mail for intake requests). */
export const emailAlertsEnabled = () => on('JOB_ALERTS_EMAIL_ENABLED');
/** SMS / WhatsApp / voice alerts: need the flag AND provider credentials (lib/urgent/channels.ts). */
export const smsAlertsEnabled = () => on('JOB_ALERTS_SMS_ENABLED');
export const whatsappAlertsEnabled = () => on('JOB_ALERTS_WHATSAPP_ENABLED');
export const voiceAlertsEnabled = () => on('JOB_ALERTS_VOICE_ENABLED');
/** Spoed escalation (10-minute timer, 24/7 businesses, calls). Defaults to on when email alerts are on. */
export const escalationEnabled = () => process.env.SPOED_ESCALATION_ENABLED ? on('SPOED_ESCALATION_ENABLED') : emailAlertsEnabled();

/** Minutes before an unaccepted spoed request escalates to 24/7 businesses (default 10). */
export function escalateAfterMinutes() {
  const n = Number(process.env.SPOED_ESCALATE_AFTER_MIN || 10);
  return Number.isFinite(n) && n >= 1 && n <= 120 ? n : 10;
}
/** Minutes between automated calls to the next 24/7 business (default 3). */
export function callGapMinutes() {
  const n = Number(process.env.SPOED_CALL_GAP_MIN || 3);
  return Number.isFinite(n) && n >= 1 && n <= 30 ? n : 3;
}

/** Test safety: when set, every SMS/WhatsApp/voice alert goes to this number instead of the business. */
export const phoneRedirect = () => (process.env.ALERTS_REDIRECT_PHONE || '').trim() || null;

export function urgentStatus() {
  return {
    intake: intakeEnabled(), email: emailAlertsEnabled(), sms: smsAlertsEnabled(), whatsapp: whatsappAlertsEnabled(),
    voice: voiceAlertsEnabled(), escalation: escalationEnabled(), escalateAfterMinutes: escalateAfterMinutes(),
  };
}

/**
 * WhatsApp fallback for the help assistant (/hulp): the number residents can message when the chat
 * fails. E.164 digits from WHATSAPP_CONTACT_NUMBER ("+31612345678", "31612345678" and "0031…" all
 * work). Unset or invalid = the WhatsApp buttons are hidden.
 */
export function whatsappContactNumber(): string | null {
  const digits = (process.env.WHATSAPP_CONTACT_NUMBER || '').replace(/\D/g, '').replace(/^00/, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
