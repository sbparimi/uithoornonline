import 'server-only';
import { sendEmail } from './email/send';

// Owner notifications. Every new request, signup, review, contact message and payment event is
// emailed to the site's operations inbox (Tab, the site's digital assistant, reads it) and to the
// owner's own address when OWNER_NOTIFY_EMAIL is set.
const OPS_INBOX = 'uithoorn.online@mail.tab.bot';

export type NotifyEvent = 'new_request' | 'new_signup' | 'new_business' | 'new_review' | 'new_contact' | 'new_submission' | 'payment' | 'account_deleted';

const titles: Record<NotifyEvent, string> = {
  new_request: 'Nieuwe hulpvraag',
  new_signup: 'Nieuwe aanmelding',
  new_business: 'Nieuw bedrijf wacht op goedkeuring',
  new_review: 'Nieuwe beoordeling',
  new_contact: 'Nieuw contactbericht',
  new_submission: 'Nieuwe inzending',
  payment: 'Betaling',
  account_deleted: 'Account verwijderd',
};

function recipients() {
  const extra = (process.env.OWNER_NOTIFY_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([process.env.OPS_NOTIFY_EMAIL || OPS_INBOX, ...extra])];
}

/** Fire-and-forget owner notification. Never throws; never blocks the user's request on email. */
export async function notify(event: NotifyEvent, summary: string, details: Record<string, unknown> = {}) {
  try {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://uithoorn.online').replace(/\/$/, '');
    const lines = Object.entries(details).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
    await sendEmail({
      to: recipients(),
      kind: `notify:${event}`,
      subject: `[Uithoorn.online] ${titles[event]}: ${summary}`.slice(0, 200),
      text: `${titles[event]}\n\n${summary}\n\n${lines.join('\n')}\n\nAdmin: ${site}/admin\n`,
    });
  } catch (error) {
    console.error('[notify] failed', event, error instanceof Error ? error.message : error);
  }
}
