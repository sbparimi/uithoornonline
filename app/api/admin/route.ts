import { after } from 'next/server';
import { errorJson, handle, json, readJson, str } from '@/lib/http';
import { requireRole, type Role, type SessionUser } from '@/lib/auth/session';
import * as legacy from '@/lib/data/admin';
import * as B from '@/lib/admin/businesses';
import * as U from '@/lib/admin/users';
import * as Q from '@/lib/admin/requests';
import * as P from '@/lib/admin/payments';
import * as C from '@/lib/admin/contacts';
import * as I from '@/lib/admin/issues';
import * as M from '@/lib/admin/misc';
import { MigrationPendingError, money } from '@/lib/admin/core';
import { sendEmail, sendEmailDetailed } from '@/lib/email/send';
import { adminReplyEmail, businessDecisionEmail, localPath, newLeadEmail, passwordResetEmail, paymentReceiptEmail, siteUrl } from '@/lib/email/templates';
import { createAuthToken, RESET_TOKEN_MINUTES } from '@/lib/auth/tokens';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * CSRF: JSON requests cannot be sent cross-site without a CORS preflight (which this API never allows),
 * and the session cookie is SameSite=Lax. Form posts (which other sites CAN send) must carry an Origin
 * or Referer header from this host.
 */
function csrfOk(request: Request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const origin = request.headers.get('origin');
  const check = (value: string) => { try { return new URL(value).host === host; } catch { return false; } };
  if (origin && origin !== 'null') return check(origin);
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return true;
  const referer = request.headers.get('referer');
  return Boolean(referer && check(referer));
}

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireRole('admin');
    const section = new URL(request.url).searchParams.get('section') || 'stats';
    switch (section) {
      case 'stats': return json(await legacy.adminStats(user));
      case 'dashboard': return json(await M.dashboard(user));
      case 'businesses': return json(await legacy.adminListBusinesses(user));
      case 'requests': return json(await legacy.adminListRequests(user));
      case 'reviews': return json(await legacy.adminListReviews(user));
      case 'users': return json(await legacy.adminListUsers(user, new URL(request.url).searchParams.get('q') || ''));
      case 'leads': return json(await legacy.adminListLeads(user));
      case 'inbox': return json(await legacy.adminListInbox(user));
      case 'payments': return json(await P.listPayments(user, {}));
      case 'issues': return json(await I.listIssues(user, {}));
      case 'emails': return json(await M.listEmails(user, {}));
      case 'audit': return json(await M.listAudit(user, {}));
      default: return errorJson('unknown_section', 400);
    }
  }, 'admin/get');
}

type Body = Record<string, unknown>;
type Outcome = { ok: true; result?: unknown; flash?: string; go?: string } | { error: string; status?: number };
const bool = (v: unknown) => v === true || v === 'true' || v === 'on' || v === '1';
const fail = (error: string, status = 400): Outcome => ({ error, status });
const done = (flash = 'saved', extra: { result?: unknown; go?: string } = {}): Outcome => ({ ok: true, flash, ...extra });
const r = (x: unknown, flash = 'saved'): Outcome => (x && typeof x === 'object' && 'error' in (x as object) ? fail(String((x as { error: string }).error)) : x ? done(flash, { result: x }) : fail('not_found', 404));

async function sendResetFor(admin: SessionUser, id: string): Promise<Outcome> {
  const u = await U.userForReset(admin, id);
  if (!u) return fail('not_found', 404);
  if (u.disabled_at) return fail('user_suspended');
  const token = await createAuthToken(u.email, 'reset', RESET_TOKEN_MINUTES);
  const url = `${siteUrl()}${localPath(u.locale, '/reset-password')}?token=${encodeURIComponent(token)}`;
  const res = await sendEmailDetailed({ to: u.email, kind: 'password_reset_admin', lang: u.locale, ...passwordResetEmail(u.locale, url, RESET_TOKEN_MINUTES) });
  await legacy.auditRaw(admin, 'user_reset_email', 'user', id, { email_status: res.status });
  return res.status === 'failed' ? fail('email_failed', 502) : done(res.status === 'skipped' ? 'email_skipped' : 'reset_sent');
}

async function receiptFor(paymentId: string, admin: SessionUser) {
  const p = await P.getPayment(admin, paymentId);
  if (!p || p.status !== 'paid' || !p.owner_email) return 'no_recipient' as const;
  const lang = p.owner_locale ?? 'nl';
  const res = await sendEmail({ to: p.owner_email, kind: 'payment_receipt', lang, ref: `payment:${p.id}`, ...paymentReceiptEmail(lang, {
    businessName: p.business_name, amount: money(p.amount_cents), description: P.describePayment(p, lang), method: p.method, paidOn: p.paid_on ?? '', reference: p.id.slice(0, 8).toUpperCase(),
  }) });
  if (res === 'sent' || res === 'skipped') await P.markReceiptSent(p.id);
  return res;
}

const ACTIONS: Record<string, (u: SessionUser, b: Body) => Promise<Outcome>> = {
  // ---- businesses
  'business.create': async (u, b) => { const c = B.cleanBusiness(b); if (c.error) return fail(c.error); const x = await B.createBusiness(u, c.value); return 'error' in x ? fail(x.error!) : done('created', { go: `businesses&id=${x.id}` }); },
  'business.update': async (u, b) => {
    const c = B.cleanBusiness(b); if (c.error) return fail(c.error);
    const x = await B.updateBusiness(u, str(b.id, 40), c.value); if ('error' in x) return fail(x.error!);
    if (x.statusChanged && c.value.moderation_status !== 'pending' && bool(b.notify_owner)) {
      const owner = await legacy.ownerOf(str(b.id, 40));
      if (owner?.email) after(() => sendEmail({ to: owner.email, kind: `business_${c.value.moderation_status}`, lang: owner.locale, ...businessDecisionEmail(owner.locale, c.value.name, c.value.moderation_status === 'approved') }));
    }
    return done();
  },
  'business.approve': async (u, b) => moderate(u, b, 'approved'),
  'business.reject': async (u, b) => moderate(u, b, 'rejected'),
  'business.pending': async (u, b) => moderate(u, b, 'pending'),
  'business.flags': async (u, b) => r(await B.setFlags(u, str(b.id, 40), { verified: b.verified === undefined ? undefined : bool(b.verified), featured: b.featured === undefined ? undefined : bool(b.featured), active: b.active === undefined ? undefined : bool(b.active) })),
  'business.plan': async (u, b) => {
    const plan = str(b.plan, 20) as B.PlanKey;
    const months = Math.max(1, Math.min(24, Number.parseInt(str(b.months, 3), 10) || 1));
    const x = await B.setPlan(u, str(b.id, 40), plan, str(b.note, 500) || null, months);
    if (x && plan !== 'free') after(() => notify('payment', `Plan ${plan} handmatig geactiveerd`, { businessId: str(b.id, 40), note: str(b.note, 500) }));
    return x ? done('saved', { result: { unlocked: x.unlocked } }) : fail('not_found', 404);
  },
  'business.credits': async (u, b) => r(await B.setCredits(u, str(b.id, 40), Number.parseInt(str(b.credits, 6), 10))),
  'business.owner': async (u, b) => { const x = await legacy.adminSetBusinessOwner(u, str(b.id, 40), str(b.email, 254) || null); return x === 'ok' ? done() : fail(x); },
  'business.delete': async (u, b) => (str(b.confirm, 20) !== 'DELETE' ? fail('confirm_required') : (await B.deleteBusiness(u, str(b.id, 40))) ? done('deleted', { go: 'businesses' }) : fail('not_found', 404)),
  'business.photo_add': async (u, b) => r(await B.addPhoto(u, str(b.id, 40), str(b.url, 500), str(b.alt, 200))),
  'business.photo_delete': async (u, b) => r(await B.deletePhoto(u, str(b.photo_id, 40)), 'deleted'),
  // ---- users
  'user.create': async (u, b) => {
    const c = U.cleanUser(b); if (c.error) return fail(c.error);
    const x = await U.createUser(u, c.value); if ('error' in x || !x.id) return fail(x.error ?? 'error');
    if (bool(b.send_reset)) await sendResetFor(u, x.id);
    return done('created', { go: `users&id=${x.id}` });
  },
  'user.update': async (u, b) => { const c = U.cleanUser(b); if (c.error) return fail(c.error); return r(await U.updateUser(u, str(b.id, 40), c.value)); },
  'user.role': async (u, b) => r(await U.setRole(u, str(b.id, 40), str(b.role, 20) as Role)),
  'user.disable': async (u, b) => r(await U.setSuspended(u, str(b.id, 40), true)),
  'user.enable': async (u, b) => r(await U.setSuspended(u, str(b.id, 40), false)),
  'user.suspend': async (u, b) => r(await U.setSuspended(u, str(b.id, 40), true)),
  'user.unsuspend': async (u, b) => r(await U.setSuspended(u, str(b.id, 40), false)),
  'user.delete': async (u, b) => { const x = await U.deleteUser(u, str(b.id, 40), str(b.confirm, 254)); return 'error' in x ? fail(x.error!) : done('deleted', { go: 'users' }); },
  'user.reset': async (u, b) => sendResetFor(u, str(b.id, 40)),
  // ---- requests & leads
  'request.update': async (u, b) => r(await Q.updateRequest(u, str(b.id, 40), { status: str(b.status, 30), hidden: bool(b.hidden), hidden_reason: str(b.hidden_reason, 300) || null, category: str(b.category, 120), description: str(b.description, 3000), postcode: str(b.postcode, 10).toUpperCase() })),
  'request.hide': async (u, b) => r(await Q.setRequestHidden(u, str(b.id, 40), true, str(b.note, 500) || null)),
  'request.unhide': async (u, b) => r(await Q.setRequestHidden(u, str(b.id, 40), false, null)),
  'request.delete': async (u, b) => (str(b.confirm, 20) !== 'DELETE' ? fail('confirm_required') : (await Q.deleteRequest(u, str(b.id, 40))) ? done('deleted', { go: 'requests' }) : fail('not_found', 404)),
  'lead.assign': async (u, b) => {
    const x = await Q.assignLead(u, str(b.id, 40), str(b.business_id, 40));
    if ('error' in x) return fail(x.error!);
    const owner = x.business;
    if (owner.owner_email && bool(b.notify ?? 'true')) after(() => sendEmail({ to: owner.owner_email!, kind: 'new_lead', lang: owner.owner_locale ?? 'nl', ...newLeadEmail(owner.owner_locale ?? 'nl', owner.name, x.category, false) }));
    return done('assigned');
  },
  'lead.status': async (u, b) => r(await Q.setLeadStatus(u, str(b.lead_id, 40), str(b.status, 20))),
  'lead.delete': async (u, b) => r(await Q.deleteLead(u, str(b.lead_id, 40)), 'deleted'),
  // ---- payments
  'payment.create': async (u, b) => {
    const c = P.cleanPayment(b); if (c.error) return fail(c.error);
    const x = await P.createPayment(u, c.value); if ('error' in x && x.error) return fail(x.error);
    if (!('id' in x) || !x.id) return fail('error');
    after(() => notify('payment', `${money(c.value.amount_cents)} ${c.value.status === 'paid' ? 'betaald' : 'open'} (${c.value.method})`, { paymentId: x.id, kind: c.value.kind, plan: c.value.plan_key, leads: c.value.lead_credits || undefined, note: c.value.note }));
    if (x.applied && bool(b.send_receipt)) after(async () => { await receiptFor(x.id, u); });
    return done(x.applied ? 'payment_applied' : 'created', { go: 'payments', result: x });
  },
  'payment.update': async (u, b) => {
    const c = P.cleanPayment(b); if (c.error) return fail(c.error);
    const x = await P.updatePayment(u, str(b.id, 40), c.value); if ('error' in x) return fail(x.error!);
    if (x.becamePaid && bool(b.send_receipt)) after(async () => { await receiptFor(str(b.id, 40), u); });
    return done(x.becamePaid ? 'payment_applied' : 'saved');
  },
  'payment.paid': async (u, b) => { const x = await P.setPaymentStatus(u, str(b.id, 40), 'paid'); if ('error' in x) return fail(x.error!); if (bool(b.send_receipt)) after(async () => { await receiptFor(str(b.id, 40), u); }); return done('payment_applied'); },
  'payment.unpaid': async (u, b) => r(await P.setPaymentStatus(u, str(b.id, 40), 'unpaid')),
  'payment.receipt': async (u, b) => { const x = await receiptFor(str(b.id, 40), u); return x === 'no_recipient' ? fail('no_recipient') : x === 'failed' ? fail('email_failed', 502) : done('receipt_sent'); },
  'payment.delete': async (u, b) => (await P.deletePayment(u, str(b.id, 40))) ? done('deleted', { go: 'payments' }) : fail('not_found', 404),
  // ---- contacts
  'contact.status': async (u, b) => r(await C.setContactStatus(u, str(b.kind, 10) || 'form', str(b.id, 40), str(b.status, 20))),
  'contact.delete': async (u, b) => (await C.deleteContact(u, str(b.kind, 10) || 'form', str(b.id, 40))) ? done('deleted', { go: 'contacts' }) : fail('not_found', 404),
  'contact.reply': async (u, b) => {
    const kind = str(b.kind, 10) || 'form'; const id = str(b.id, 40);
    const found = await C.getContact(u, kind, id); if (!found) return fail('not_found', 404);
    const subject = str(b.subject, 300) || `Re: ${found.contact.subject || 'Uithoorn.online'}`; const text = str(b.body, 10000);
    if (text.length < 2) return fail('empty_reply');
    const lang = b.lang === 'en' ? 'en' : 'nl';
    const res = await sendEmailDetailed({ to: found.contact.email, kind: 'admin_reply', lang, ref: `${kind}:${id}`, ...adminReplyEmail(lang, subject, text) });
    await C.recordReply(u, kind, id, found.contact.email, subject, text, res.status);
    return res.status === 'failed' ? fail('email_failed', 502) : done(res.status === 'skipped' ? 'email_skipped' : 'reply_sent');
  },
  'contact.to_issue': async (u, b) => {
    const kind = str(b.kind, 10) || 'form'; const id = str(b.id, 40);
    const found = await C.getContact(u, kind, id); if (!found) return fail('not_found', 404);
    const issue = await I.createIssue(u, { title: (found.contact.subject || found.contact.body.slice(0, 80) || 'Contact').slice(0, 200), body: `${found.contact.name} <${found.contact.email}>\n\n${found.contact.body}`.slice(0, 10000), status: 'open', priority: 'normal', notes: '', business_id: null, source: kind === 'email' ? 'email' : 'contact', contact_message_id: kind === 'form' ? id : null, inbound_email_id: kind === 'email' ? id : null });
    after(() => notify('new_issue', issue.title, { from: found.contact.email }));
    return done('created', { go: `issues&id=${issue.id}` });
  },
  'submission.status': async (u, b) => r(await C.setSubmissionStatus(u, str(b.id, 40), str(b.status, 20))),
  'submission.delete': async (u, b) => r(await C.deleteSubmission(u, str(b.id, 40)), 'deleted'),
  // ---- issues
  'issue.create': async (u, b) => { const c = I.cleanIssue(b); if (c.error) return fail(c.error); const x = await I.createIssue(u, { ...c.value, source: ['report', 'admin'].includes(str(b.source, 10)) ? str(b.source, 10) : 'admin' }); after(() => notify('new_issue', x.title, { priority: x.priority })); return done('created', { go: `issues&id=${x.id}` }); },
  'issue.update': async (u, b) => { const c = I.cleanIssue(b); if (c.error) return fail(c.error); return r(await I.updateIssue(u, str(b.id, 40), c.value)); },
  'issue.status': async (u, b) => r(await I.setIssueStatus(u, str(b.id, 40), str(b.status, 20))),
  'issue.delete': async (u, b) => (await I.deleteIssue(u, str(b.id, 40))) ? done('deleted', { go: 'issues' }) : fail('not_found', 404),
  // ---- reviews & settings
  'review.hide': async (u, b) => r(await legacy.adminHideReview(u, str(b.id, 40), true, str(b.note, 500) || null)),
  'review.unhide': async (u, b) => r(await legacy.adminHideReview(u, str(b.id, 40), false, null)),
  'plan.update': async (u, b) => r(await M.updatePlan(u, str(b.key, 20), { name: str(b.name, 40), monthly_price_cents: Math.round(Number(str(b.price, 12).replace(',', '.')) * 100), included_leads: Number.parseInt(str(b.included_leads, 6), 10) })),
};

async function moderate(u: SessionUser, b: Body, decision: 'approved' | 'rejected' | 'pending'): Promise<Outcome> {
  const row = await B.moderate(u, str(b.id, 40), decision, str(b.note, 500) || null);
  if (!row) return fail('not_found', 404);
  if (row.owner_email && decision !== 'pending' && b.notify_owner !== 'false') {
    const lang = row.owner_locale ?? 'nl';
    after(() => sendEmail({ to: row.owner_email!, kind: `business_${decision}`, lang, ...businessDecisionEmail(lang, row.name, decision === 'approved') }));
  }
  return done(decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'saved');
}

function safeReturn(value: unknown) {
  const v = String(value ?? '');
  return /^\/(en\/)?admin(\?[^\s]*)?$/.test(v) ? v : null;
}

export async function POST(request: Request) {
  return handle(async () => {
    if (!csrfOk(request)) return errorJson('bad_origin', 403);
    const user = await requireRole('admin');
    const body = await readJson(request);
    const action = str(body.action, 40);
    const fn = ACTIONS[action];
    if (!fn) return errorJson('unknown_action', 400);
    let outcome: Outcome;
    try { outcome = await fn(user, body); } catch (error) {
      if (error instanceof MigrationPendingError) outcome = fail('migration_pending', 409); else throw error;
    }
    const isForm = (request.headers.get('content-type') || '').includes('form') && !(request.headers.get('accept') || '').includes('application/json');
    if (isForm) {
      const base = safeReturn(body.return) || safeReturn(new URL(request.headers.get('referer') || '/admin', request.url).pathname + new URL(request.headers.get('referer') || '/admin', request.url).search) || '/admin';
      const url = new URL(base, request.url);
      url.searchParams.delete('ok'); url.searchParams.delete('err');
      if ('error' in outcome) url.searchParams.set('err', outcome.error);
      else {
        if (outcome.go) { const [tab, rest] = outcome.go.split('&'); url.searchParams.set('tab', tab); url.searchParams.delete('id'); url.searchParams.delete('edit'); if (rest) { const [k, v] = rest.split('='); url.searchParams.set(k, v); } }
        url.searchParams.set('ok', outcome.flash ?? 'saved');
      }
      return Response.redirect(url.toString(), 303);
    }
    if ('error' in outcome) return errorJson(outcome.error, outcome.status ?? 400);
    return json({ ok: true, result: outcome.result ?? true });
  }, 'admin/post');
}
