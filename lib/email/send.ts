import 'server-only';
import { query } from '../db';

// Transactional email via Resend's HTTP API (no SDK). Without RESEND_API_KEY nothing is sent:
// the attempt is recorded in email_outbox with status 'skipped' so the admin page shows it.
// TODO(owner): create a Resend account, verify uithoorn.online (DNS records at mijndomein.nl),
// then set RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel.

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export type Email = { to: string | string[]; subject: string; text: string; html?: string; kind: string; replyTo?: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function textToHtml(text: string) {
  const body = escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>');
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#111">${body}</div>`;
}

export async function sendEmail(email: Email): Promise<'sent' | 'skipped' | 'failed'> {
  const recipients = (Array.isArray(email.to) ? email.to : [email.to]).filter(Boolean);
  if (!recipients.length) return 'skipped';
  const record = async (status: string, providerId: string | null, error: string | null) => {
    for (const to of recipients) {
      await query('insert into email_outbox(to_address, subject, kind, status, provider_id, error) values ($1,$2,$3,$4,$5,$6)', [to, email.subject.slice(0, 300), email.kind, status, providerId, error?.slice(0, 500) ?? null]).catch(() => undefined);
    }
  };
  if (!emailConfigured()) {
    await record('skipped', null, 'RESEND_API_KEY not configured');
    return 'skipped';
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Uithoorn.online <noreply@uithoorn.online>',
        to: recipients,
        subject: email.subject,
        text: email.text,
        html: email.html ?? textToHtml(email.text),
        reply_to: email.replyTo,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) { await record('failed', null, data.message || `HTTP ${response.status}`); return 'failed'; }
    await record('sent', data.id ?? null, null);
    return 'sent';
  } catch (error) {
    await record('failed', null, error instanceof Error ? error.message : String(error));
    return 'failed';
  }
}
