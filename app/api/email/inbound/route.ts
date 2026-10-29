import { after } from 'next/server';
import { errorJson, json } from '@/lib/http';
import { verifyWebhook } from '@/lib/email/webhook';
import { adminEmail, sendEmail } from '@/lib/email/send';
import { inboundForwardEmail, siteUrl } from '@/lib/email/templates';
import { storeInboundEmail } from '@/lib/admin/contacts';
import { notifyRecipients } from '@/lib/notify';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Resend inbound email webhook (event "email.received"). Signature-verified with RESEND_WEBHOOK_SECRET.
// Only mail addressed to INBOUND_DOMAINS (default uithoorn.online) is handled; other domains on the
// same Resend account are acknowledged and ignored. The email is stored in Contacts (admin) and a copy
// is forwarded to the admin (reachparimi@gmail.com) with Reply-To set to the original sender.

type ReceivedEvent = { type?: string; data?: { email_id?: string; from?: string; to?: string[]; received_for?: string[]; subject?: string } };
type ReceivedEmail = { id?: string; from?: string; to?: string[]; subject?: string; text?: string | null; html?: string | null };

function domains() {
  return (process.env.INBOUND_DOMAINS || 'uithoorn.online').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
}
const addr = (v: string) => (v.match(/<([^>]+)>/)?.[1] ?? v).trim().toLowerCase();
function htmlToText(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 1_000_000) return errorJson('too_large', 413);
  const verified = verifyWebhook(raw, request.headers, process.env.RESEND_WEBHOOK_SECRET);
  if (!verified.ok) return errorJson('invalid_signature', 401);
  let event: ReceivedEvent;
  try { event = JSON.parse(raw); } catch { return errorJson('invalid_json', 400); }
  if (event.type !== 'email.received' || !event.data?.email_id) return json({ ok: true, ignored: 'event' });

  const recipients = [...(event.data.to ?? []), ...(event.data.received_for ?? [])].map(addr);
  if (!recipients.some((r) => domains().includes(r.split('@')[1] ?? ''))) return json({ ok: true, ignored: 'domain' });

  // The webhook carries metadata only; fetch the body from Resend.
  let full: ReceivedEmail = {};
  try {
    const base = (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '');
    const res = await fetch(`${base}/emails/receiving/${encodeURIComponent(event.data.email_id)}?html_format=cid`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(8000) });
    if (res.ok) full = await res.json();
    else console.error('[inbound] fetch failed', res.status);
  } catch (error) { console.error('[inbound] fetch error', error instanceof Error ? error.message : error); }

  const from = full.from || event.data.from || 'unknown';
  const to = (full.to ?? event.data.to ?? []).join(', ');
  const subject = full.subject ?? event.data.subject ?? '';
  const text = full.text || (full.html ? htmlToText(full.html) : '');
  let stored: { id: string; inserted: boolean } | null = null;
  try {
    stored = await storeInboundEmail({ providerId: event.data.email_id, from, to, subject, text, html: full.html ?? null });
  } catch (error) {
    console.error('[inbound] store failed', error instanceof Error ? error.message : error);
    return errorJson('store_failed', 500); // Resend retries
  }
  if (stored?.inserted) {
    const link = `${siteUrl()}/admin?tab=contacts&kind=email&id=${stored.id}`;
    const sender = addr(from);
    // Never loop: don't forward mail that came from the admin/ops addresses themselves.
    const forwardTo = notifyRecipients().filter((r) => r !== sender);
    after(async () => {
      if (forwardTo.length) {
        const mail = inboundForwardEmail(from, to, subject, text, link);
        const status = await sendEmail({ to: forwardTo.includes(adminEmail()) ? forwardTo : [adminEmail(), ...forwardTo], kind: 'inbound_forward', adminCopy: false, replyTo: sender, ref: `inbound:${stored!.id}`, ...mail });
        if (status === 'sent') await query('update inbound_emails set forwarded_at = now() where id = $1', [stored!.id]).catch(() => undefined);
      }
    });
  }
  return json({ ok: true, id: stored?.id ?? null });
}
