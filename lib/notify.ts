import 'server-only';
import { adminEmail, sendEmail } from './email/send';
import { adminAlertEmail, siteUrl } from './email/templates';

// Admin alerts. Every new signup, business, request, contact message, inbound email, issue, review
// and payment event is emailed to the admin (ADMIN_EMAIL, default reachparimi@gmail.com), to the
// site's operations inbox (uithoorn.online@mail.tab.bot) and to OWNER_NOTIFY_EMAIL when set.
const OPS_INBOX = 'uithoorn.online@mail.tab.bot';

export type NotifyEvent = 'new_request' | 'new_signup' | 'new_business' | 'new_review' | 'new_contact' | 'new_submission' | 'payment' | 'account_deleted' | 'new_issue' | 'new_inbound_email' | 'business_updated' | 'spoed_unhandled' | 'request_unanswered';

const titles: Record<NotifyEvent, string> = {
  new_request: 'Nieuwe hulpvraag',
  new_signup: 'Nieuwe aanmelding',
  business_updated: 'Bedrijfsprofiel gewijzigd',
  new_business: 'Nieuw bedrijf wacht op goedkeuring',
  new_review: 'Nieuwe beoordeling',
  new_contact: 'Nieuw contactbericht',
  new_submission: 'Nieuwe inzending',
  payment: 'Betaling',
  account_deleted: 'Account verwijderd',
  new_issue: 'Nieuw issue',
  new_inbound_email: 'Nieuwe e-mail ontvangen',
  spoed_unhandled: 'SPOED: niemand heeft geaccepteerd',
  request_unanswered: 'Aanvraag zonder offerte: graag persoonlijk opvolgen',
};

const adminTab: Partial<Record<NotifyEvent, string>> = {
  new_request: 'requests', new_signup: 'users', new_business: 'businesses', new_contact: 'contacts', new_submission: 'contacts',
  payment: 'payments', new_issue: 'issues', new_inbound_email: 'contacts', new_review: 'reviews', account_deleted: 'users', spoed_unhandled: 'urgent', request_unanswered: 'requests',
};

export function notifyRecipients() {
  const extra = (process.env.OWNER_NOTIFY_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([adminEmail(), process.env.OPS_NOTIFY_EMAIL || OPS_INBOX, ...extra].map((s) => s.toLowerCase()))];
}

/** Admin alert. Never throws; never blocks the user's request on email. */
export async function notify(event: NotifyEvent, summary: string, details: Record<string, unknown> = {}) {
  try {
    const rows = Object.entries(details)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, (typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 600)] as [string, string]);
    const link = `${siteUrl()}/admin${adminTab[event] ? `?tab=${adminTab[event]}` : ''}`;
    const mail = adminAlertEmail(titles[event], summary, rows, link);
    await sendEmail({ to: notifyRecipients(), kind: `notify:${event}`, adminCopy: false, lang: 'nl', ...mail });
  } catch (error) {
    console.error('[notify] failed', event, error instanceof Error ? error.message : error);
  }
}
