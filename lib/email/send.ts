import 'server-only';
import { CONTACT_EMAIL } from '../contact';
import { query } from '../db';

// Transactional email via Resend's HTTP API (no SDK).
// - Every outgoing email also goes to the admin (ADMIN_EMAIL, default reachparimi@gmail.com) as a BCC,
//   unless the admin is already a recipient (owner rule 2026-10-28: "every email must go to reachparimi@gmail.com").
// - Every attempt is logged in email_outbox (to, bcc, kind, status, Resend id, error).
// - Without RESEND_API_KEY nothing is sent: the attempt is logged as 'skipped'.
// - RESEND_API_URL can point at a local mock (tests); default https://api.resend.com.

export const DEFAULT_ADMIN_EMAIL = 'reachparimi@gmail.com';
export function adminEmail() {
  return (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function fromAddress() {
  return process.env.RESEND_FROM_EMAIL || 'Uithoorn.online <noreply@uithoorn.online>';
}

export type Email = {
  to: string | string[]; subject: string; text: string; html?: string; kind: string; replyTo?: string;
  /** Throttle/grouping key stored with the log row (e.g. "msg:<conversation>:<user>"). */
  ref?: string; lang?: string;
  /** Default true: BCC the admin. False only for mail that already goes to the admin. */
  adminCopy?: boolean;
};
export type SendStatus = 'sent' | 'skipped' | 'failed';
export type SendResult = { status: SendStatus; id: string | null; error: string | null };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function textToHtml(text: string) {
  const body = escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>');
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#111">${body}</div>`;
}

async function logAttempt(email: Email, recipients: string[], bcc: string | null, status: SendStatus, providerId: string | null, error: string | null) {
  for (const to of recipients) await logOne(email, to, bcc, status, providerId, error);
}

async function logOne(email: Email, to: string, bcc: string | null, status: SendStatus, providerId: string | null, error: string | null) {
  const subject = email.subject.slice(0, 300);
  const err = error?.slice(0, 500) ?? null;
  try {
    await query('insert into email_outbox(to_address, subject, kind, status, provider_id, error, bcc_address, ref, lang) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [to, subject, email.kind.slice(0, 60), status, providerId, err, bcc, email.ref?.slice(0, 200) ?? null, email.lang ?? null]);
  } catch (e) {
    // Migration 0002 not applied yet: log in the original columns.
    const code = (e as { code?: string })?.code;
    if (code === '42703') await query('insert into email_outbox(to_address, subject, kind, status, provider_id, error) values ($1,$2,$3,$4,$5,$6)', [to, subject, email.kind.slice(0, 60), status, providerId, err]).catch(() => undefined);
  }
}

/** True when an email with this ref was sent within the last `minutes` (used to throttle chat notifications). */
export async function sentRecently(ref: string, minutes: number) {
  try {
    const rows = await query<{ n: number }>(`select count(*)::int as n from email_outbox where ref = $1 and status in ('sent','skipped') and created_at > now() - make_interval(mins => $2)`, [ref, minutes]);
    return (rows[0]?.n ?? 0) > 0;
  } catch { return false; }
}

// job_alert / job_taken carry a one-tap accept link for a business (and go out in bulk per request):
// the admin sees them in Admin → Spoed (alert log) instead of a BCC copy of each.
const NO_ADMIN_COPY = new Set(['login_link', 'password_reset', 'password_reset_admin', 'job_alert', 'job_taken']);

/** Test safety (previews): EMAIL_REDIRECT_TO sends every email to that address instead, original recipient in the subject. */
function redirected(email: Email, recipients: string[]): { email: Email; recipients: string[] } {
  const to = (process.env.EMAIL_REDIRECT_TO || '').trim();
  if (!to) return { email, recipients };
  return { email: { ...email, adminCopy: false, subject: `[TEST → ${recipients.join(', ')}] ${email.subject}` }, recipients: [to] };
}

export async function sendEmailDetailed(original: Email): Promise<SendResult> {
  const originalRecipients = [...new Set((Array.isArray(original.to) ? original.to : [original.to]).map((s) => String(s || '').trim()).filter(Boolean))];
  if (!originalRecipients.length) return { status: 'skipped', id: null, error: 'no recipient' };
  const { email, recipients } = redirected(original, originalRecipients);
  const admin = adminEmail();
  // Sign-in and reset links are credentials for someone else's account: never copy them to the admin.
  const bcc = email.adminCopy === false || NO_ADMIN_COPY.has(email.kind) || recipients.some((r) => r.toLowerCase() === admin) ? null : admin;
  if (!emailConfigured()) {
    await logAttempt(email, recipients, bcc, 'skipped', null, 'RESEND_API_KEY not configured');
    return { status: 'skipped', id: null, error: 'RESEND_API_KEY not configured' };
  }
  try {
    const base = (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '');
    const response = await fetch(`${base}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress(),
        to: recipients,
        ...(bcc ? { bcc: [bcc] } : {}),
        subject: `${process.env.EMAIL_SUBJECT_PREFIX || ''}${email.subject}`,
        text: email.text,
        html: email.html ?? textToHtml(email.text),
        reply_to: email.replyTo ?? CONTACT_EMAIL,
        tags: [{ name: 'kind', value: email.kind.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) {
      const error = data.message || `HTTP ${response.status}`;
      await logAttempt(email, recipients, bcc, 'failed', null, error);
      return { status: 'failed', id: null, error };
    }
    await logAttempt(email, recipients, bcc, 'sent', data.id ?? null, null);
    return { status: 'sent', id: data.id ?? null, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAttempt(email, recipients, bcc, 'failed', null, message);
    return { status: 'failed', id: null, error: message };
  }
}

export async function sendEmail(email: Email): Promise<SendStatus> {
  return (await sendEmailDetailed(email)).status;
}
