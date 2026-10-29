#!/usr/bin/env node
// Admin console, password reset, payments ledger, email and inbound-webhook tests with REAL HTTP
// requests against a running instance on a LOCAL database, with Resend replaced by a local mock.
//   Start the app with: RESEND_API_KEY=test RESEND_API_URL=http://127.0.0.1:3999 RESEND_WEBHOOK_SECRET=whsec_dGVzdC1zZWNyZXQtMTIzNDU2Nzg5MA== ADMIN_EMAIL=owner-admin@test.uithoorn.invalid
//   then: BASE_URL=http://localhost:3000 DATABASE_URL=postgres://... node scripts/admin-test.mjs
// Never run against production: it creates and deletes test accounts and data.
import http from 'node:http';
import { createHmac } from 'node:crypto';
import pg from 'pg';

const PRICING = process.env.NEXT_PUBLIC_PRICING_ENABLED === 'true'; // must match the build under test
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url || /neon\.tech/.test(url)) { console.error('Set DATABASE_URL to a LOCAL database (refusing Neon).'); process.exit(1); }
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'owner-admin@test.uithoorn.invalid';
const SECRET = process.env.RESEND_WEBHOOK_SECRET || 'whsec_dGVzdC1zZWNyZXQtMTIzNDU2Nzg5MA==';
const db = new pg.Client({ connectionString: url });
await db.connect();

// ---- Resend mock
const sent = [];
let mockId = 0;
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/emails') {
      const data = JSON.parse(body || '{}'); data._auth = req.headers.authorization; sent.push(data);
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: `mock_${++mockId}` })); return;
    }
    const m = req.url.match(/^\/emails\/receiving\/([^?]+)/);
    if (req.method === 'GET' && m) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: m[1], from: 'Jan Klant <jan.klant@example.org>', to: ['info@uithoorn.online'], subject: 'Vraag over mijn vermelding', text: 'Hallo, hoe pas ik mijn openingstijden aan?', html: '<p>Hallo</p>' })); return;
    }
    res.writeHead(404); res.end('{}');
  });
});
await new Promise((r) => mock.listen(3999, '127.0.0.1', r));

const run = Date.now().toString(36);
const results = [];
let ip = 50;
function check(name, condition, detail = '') { results.push({ name, ok: Boolean(condition) }); console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await wait(100); } return fn(); }

class Client {
  constructor(label) { this.label = label; this.cookie = ''; this.ip = `198.51.100.${ip++}`; }
  async req(method, path, body, headers = {}) {
    const h = { 'x-forwarded-for': this.ip, accept: 'application/json', ...headers };
    if (this.cookie) h.cookie = this.cookie;
    let payload;
    if (body instanceof URLSearchParams) { payload = body.toString(); h['content-type'] = 'application/x-www-form-urlencoded'; delete h.accept; }
    else if (body !== undefined) { payload = JSON.stringify(body); h['content-type'] = 'application/json'; }
    const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie?.() ?? []) { const [pair] = c.split(';'); if (pair.startsWith('uo_session=')) this.cookie = pair.endsWith('=') ? '' : pair; }
    const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }
}
const form = (extra) => ({ form_started_at: Date.now() - 5000, company_website: '', ...extra });
async function signup(c, role, extra = {}) {
  c.email = `${c.label}-${run}@test.uithoorn.invalid`; c.password = 'correct-horse-battery';
  return c.req('POST', '/api/auth/signup', form({ email: c.email, password: c.password, fullName: `Test ${c.label}`, phone: '+31600000001', role, acceptTerms: true, ...extra }));
}

try {
  const anon = new Client('anon'); const res = new Client('res'); const res2 = new Client('res2'); const biz = new Client('biz'); const admin = new Client('adm');
  await signup(res, 'customer'); await signup(res2, 'customer');
  await signup(biz, 'provider', { businessName: `Schilder Test ${run}`, businessCategory: 'Schilder & klus', businessDescription: 'Binnen- en buitenschilderwerk en kleine klussen in Uithoorn en De Kwakel.', postcode: '1421AB' });
  await signup(admin, 'customer');
  await db.query("update users set role = 'admin' where email = $1", [admin.email]);
  const bizRow = (await db.query('select b.id from businesses b join users u on u.id = b.owner_id where u.email = $1', [biz.email])).rows[0];
  check('setup: business row exists', Boolean(bizRow));

  // ---------- 1. Admin-only access to every admin route and action
  const sections = ['stats', 'dashboard', 'businesses', 'requests', 'reviews', 'users', 'leads', 'inbox', 'payments', 'issues', 'emails', 'audit'];
  let anonOk = true, resOk = true, bizOk = true, adminOk = true; const bad = [];
  for (const s of sections) {
    const a = await anon.req('GET', `/api/admin?section=${s}`); if (a.status !== 401) { anonOk = false; bad.push(`anon ${s} ${a.status}`); }
    const r = await res.req('GET', `/api/admin?section=${s}`); if (r.status !== 403) { resOk = false; bad.push(`res ${s} ${r.status}`); }
    const b = await biz.req('GET', `/api/admin?section=${s}`); if (b.status !== 403) { bizOk = false; bad.push(`biz ${s} ${b.status}`); }
    const d = await admin.req('GET', `/api/admin?section=${s}`); if (d.status !== 200) { adminOk = false; bad.push(`admin ${s} ${d.status}`); }
  }
  check(`anonymous gets 401 on all ${sections.length} admin GET sections`, anonOk, bad.filter((x) => x.startsWith('anon')).join(','));
  check(`resident gets 403 on all ${sections.length} admin GET sections`, resOk, bad.filter((x) => x.startsWith('res')).join(','));
  check(`business gets 403 on all ${sections.length} admin GET sections`, bizOk, bad.filter((x) => x.startsWith('biz')).join(','));
  check(`admin gets 200 on all ${sections.length} admin GET sections`, adminOk, bad.filter((x) => x.startsWith('admin')).join(','));

  const actions = ['business.create', 'business.update', 'business.approve', 'business.reject', 'business.pending', 'business.flags', 'business.plan', 'business.credits', 'business.owner', 'business.delete', 'business.photo_add', 'business.photo_delete',
    'user.create', 'user.update', 'user.role', 'user.disable', 'user.enable', 'user.suspend', 'user.unsuspend', 'user.delete', 'user.reset',
    'request.update', 'request.hide', 'request.unhide', 'request.delete', 'lead.assign', 'lead.status', 'lead.delete',
    'payment.create', 'payment.update', 'payment.paid', 'payment.unpaid', 'payment.receipt', 'payment.delete',
    'contact.status', 'contact.delete', 'contact.reply', 'contact.to_issue', 'submission.status', 'submission.delete',
    'issue.create', 'issue.update', 'issue.status', 'issue.delete', 'review.hide', 'review.unhide', 'plan.update'];
  const leaks = [];
  for (const action of actions) {
    const payload = { action, id: bizRow.id, plan: 'pro_plus', role: 'admin', credits: '99', amount: '10', kind: 'lead', business_id: bizRow.id, status: 'paid', title: 'x', confirm: 'DELETE', key: 'free', name: 'X', price: '0', included_leads: '999' };
    for (const [who, c, expected] of [['anon', anon, 401], ['resident', res, 403], ['business', biz, 403]]) {
      const r = await c.req('POST', '/api/admin', payload);
      if (r.status !== expected) leaks.push(`${who}:${action}:${r.status}`);
    }
  }
  check(`non-admins are refused on all ${actions.length} admin actions (anon 401, resident/business 403)`, leaks.length === 0, leaks.join(' '));
  const after = (await db.query('select moderation_status, featured from businesses where id = $1', [bizRow.id])).rows[0];
  check('…and nothing changed (business still pending, not featured)', after.moderation_status === 'pending' && after.featured === false);
  const plans = (await db.query("select included_leads from business_plans where key = 'free'")).rows[0];
  check('…and plans unchanged', plans.included_leads === 3);
  check('resident cannot export CSV (403)', (await res.req('GET', '/api/admin/export?type=users')).status === 403);
  const csv = await admin.req('GET', '/api/admin/export?type=users');
  check('admin exports users as CSV', csv.status === 200 && (csv.headers.get('content-type') || '').includes('text/csv') && String(csv.data).includes(res.email));
  const page = await res.req('GET', '/admin?tab=payments');
  check('resident opening /admin is redirected away', [302, 303, 307, 308].includes(page.status) && !String(page.headers.get('location')).includes('/admin'), `${page.status} ${page.headers.get('location')}`);
  const anonPage = await anon.req('GET', '/admin?tab=users');
  check('anonymous /admin redirects to login', [302, 303, 307, 308].includes(anonPage.status) && String(anonPage.headers.get('location')).includes('/login'));
  for (const tab of ['dashboard', 'businesses', 'users', 'requests', 'payments', 'contacts', 'issues', 'reviews', 'emails', 'audit', 'settings']) {
    const p = await admin.req('GET', `/admin?tab=${tab}`);
    if (p.status !== 200) { check(`admin page ${tab} renders`, false, String(p.status)); }
  }
  check('admin pages render (11 tabs, 200)', true);

  // ---------- 2. CSRF
  const host = new URL(BASE).host;
  const evil = await admin.req('POST', '/api/admin', new URLSearchParams({ action: 'business.flags', id: bizRow.id, featured: 'true' }), { origin: 'https://evil.example' });
  check('form post from another origin is refused (403)', evil.status === 403);
  const noOrigin = await admin.req('POST', '/api/admin', new URLSearchParams({ action: 'business.flags', id: bizRow.id, featured: 'true' }));
  check('form post without Origin/Referer is refused (403)', noOrigin.status === 403);
  const okForm = await admin.req('POST', '/api/admin', new URLSearchParams({ action: 'business.approve', id: bizRow.id, return: '/admin?tab=businesses' }), { origin: `http://${host}` });
  check('same-origin form post works and redirects back (303)', okForm.status === 303 && String(okForm.headers.get('location')).includes('ok=approved'), `${okForm.status} ${okForm.headers.get('location')}`);

  // ---------- 3. Audit log with before/after
  const upd = await admin.req('POST', '/api/admin', { action: 'business.update', id: bizRow.id, name: `Schilder Test ${run} BV`, category: 'Schilder & klus', description: 'Nieuw', moderation_status: 'approved', active: true, verified: true, featured: false, owner_email: biz.email });
  check('admin edits a business', upd.status === 200, JSON.stringify(upd.data));
  const audit = (await db.query("select details from audit_log where action = 'business_update' and target_id = $1 order by id desc limit 1", [bizRow.id])).rows[0];
  check('audit log has who + before/after', audit && audit.details.actor_email === admin.email && String(audit.details.before?.name).endsWith(run) && String(audit.details.after?.name).endsWith('BV'));
  await wait(400);
  const decisionMail = sent.find((m) => m.to?.includes(biz.email) && /goedgekeurd|staat nu/i.test(m.subject));
  check('business approved email sent to owner, BCC admin', decisionMail && decisionMail.bcc?.includes(ADMIN_EMAIL), decisionMail?.subject);

  // ---------- 4. Password reset
  const nBefore = sent.length;
  const r1 = await anon.req('POST', '/api/auth/password-reset', { email: res.email, lang: 'nl' });
  const r2 = await anon.req('POST', '/api/auth/password-reset', { email: `nobody-${run}@test.uithoorn.invalid`, lang: 'nl' });
  check('reset request: same answer for existing and unknown email', r1.status === 200 && r2.status === 200 && JSON.stringify(r1.data) === JSON.stringify(r2.data));
  const resetMail = await waitFor(() => sent.slice(nBefore).find((m) => m.to?.includes(res.email) && /wachtwoord/i.test(m.subject)));
  check('reset email sent (with BCC to admin)', resetMail && resetMail.bcc?.includes(ADMIN_EMAIL));
  await wait(300);
  check('no email for the unknown address', !sent.slice(nBefore).some((m) => m.to?.some((t) => t.startsWith('nobody-'))));
  const token = resetMail ? decodeURIComponent((resetMail.text.match(/token=([^\s&]+)/) || [])[1] || '') : '';
  check('reset link points to /reset-password with a token', token.length > 20 && /\/reset-password\?token=/.test(resetMail?.text || ''));
  check('wrong token refused', (await anon.req('POST', '/api/auth/password-reset/confirm', { token: 'nope-nope-nope-nope-nope', password: 'brand-new-password-1' })).status === 400);
  check('too-short password refused', (await anon.req('POST', '/api/auth/password-reset/confirm', { token, password: 'short' })).status === 400);
  const confirm = new Client('resetter');
  const c1 = await confirm.req('POST', '/api/auth/password-reset/confirm', { token, password: 'brand-new-password-1' });
  check('valid token sets the new password and signs in', c1.status === 200 && confirm.cookie !== '', JSON.stringify(c1.data));
  check('token is single-use (second use refused)', (await anon.req('POST', '/api/auth/password-reset/confirm', { token, password: 'another-password-22' })).status === 400);
  check('old password no longer works', (await new Client('o').req('POST', '/api/auth/login', { email: res.email, password: res.password })).status === 401);
  const newLogin = new Client('n'); const nl = await newLogin.req('POST', '/api/auth/login', { email: res.email, password: 'brand-new-password-1' });
  check('new password works', nl.status === 200);
  check('old session was signed out after reset', (await res.req('GET', '/api/auth/me')).data?.user == null);
  res.cookie = newLogin.cookie; res.password = 'brand-new-password-1';
  // expiry
  const n2 = sent.length;
  await anon.req('POST', '/api/auth/password-reset', { email: res2.email, lang: 'en' });
  const m2 = await waitFor(() => sent.slice(n2).find((m) => m.to?.includes(res2.email)));
  const token2 = m2 ? decodeURIComponent((m2.text.match(/token=([^\s&]+)/) || [])[1] || '') : '';
  check("reset email uses the account's own language (nl)", m2 && /wachtwoord/i.test(m2.subject));
  await db.query("update auth_tokens set expires_at = now() - interval '1 minute' where email = $1 and purpose = 'reset'", [res2.email]);
  check('expired token refused', (await anon.req('POST', '/api/auth/password-reset/confirm', { token: token2, password: 'brand-new-password-2' })).status === 400);
  check('expired token did not change the password', (await new Client('o2').req('POST', '/api/auth/login', { email: res2.email, password: res2.password })).status === 200);
  // a login (magic-link) token cannot be used as a reset token
  const { createHash, randomBytes } = await import('node:crypto');
  const loginToken = randomBytes(32).toString('base64url');
  await db.query("insert into auth_tokens(token_hash, email, purpose, expires_at) values ($1, $2, 'login', now() + interval '20 minutes')", [createHash('sha256').update(loginToken).digest('hex'), res2.email]);
  check('a sign-in-link token cannot reset a password', (await anon.req('POST', '/api/auth/password-reset/confirm', { token: loginToken, password: 'brand-new-password-3' })).status === 400);
  // rate limit (4 per hour per email)
  let last = 0; for (let i = 0; i < 4; i++) last = (await new Client(`rl${i}`).req('POST', '/api/auth/password-reset', { email: res2.email })).status;
  check('reset requests are rate-limited per email (429)', last === 429, String(last));
  // admin-triggered reset
  const res2Id = (await db.query('select id from users where email = $1', [res2.email])).rows[0].id;
  const n3 = sent.length;
  check('admin can send a reset link to a user', (await admin.req('POST', '/api/admin', { action: 'user.reset', id: res2Id })).status === 200 && Boolean(await waitFor(() => sent.slice(n3).find((m) => m.to?.includes(res2.email)))));
  // the owner's seeded admin account has no usable password
  const owner = (await db.query("select role, password_hash from users where email = 'reachparimi@gmail.com'")).rows[0];
  check('migration seeded reachparimi@gmail.com as admin with NO password', owner && owner.role === 'admin' && owner.password_hash === null);
  check('…so password login is impossible for it', (await new Client('own').req('POST', '/api/auth/login', { email: 'reachparimi@gmail.com', password: 'anything-at-all-123' })).status === 401);

  // ---------- 5. Payments ledger updates plan and credits
  await db.query('delete from leads where business_id = $1', [bizRow.id]);
  const resId = (await db.query('select id from users where email = $1', [res.email])).rows[0].id;
  for (let i = 0; i < 5; i++) {
    const rq = (await db.query(`insert into service_requests(customer_id, category, description, postcode, preferred_timing) values ($1, 'Schilder', 'Test schilderklus nummer ${i} voor de ledger.', '1421AB', 'Flexibel') returning id`, [resId])).rows[0];
    await db.query(`insert into leads(request_id, business_id, status) values ($1, $2, $3)`, [rq.id, bizRow.id, i < 3 ? 'new' : 'locked']);
  }
  const lockedCount = async () => Number((await db.query("select count(*) n from leads where business_id = $1 and status = 'locked'", [bizRow.id])).rows[0].n);
  const credits = async () => Number((await db.query('select coalesce((select credits from business_lead_credits where business_id = $1), 0) c', [bizRow.id])).rows[0].c);
  const planOf = async () => (await db.query("select coalesce((select plan_key from business_subscriptions where business_id = $1), 'free') p, (select current_period_end from business_subscriptions where business_id = $1) e", [bizRow.id])).rows[0];
  check('ledger setup: Free plan, 3 used + 2 locked leads', (await lockedCount()) === 2 && (await planOf()).p === 'free');
  const n4 = sent.length;
  const p1 = await admin.req('POST', '/api/admin', { action: 'payment.create', business_id: bizRow.id, amount: '10,00', kind: 'lead', lead_credits: '1', method: 'tikkie', status: 'paid', send_receipt: 'true', note: 'test' });
  check('paid single-lead payment unlocks one locked lead', p1.status === 200 && p1.data?.result?.unlocked === 1 && (await lockedCount()) === 1 && (await credits()) === 0, JSON.stringify(p1.data));
  const receipt = await waitFor(() => sent.slice(n4).find((m) => m.to?.includes(biz.email) && /betaal/i.test(m.subject)));
  check('payment receipt emailed to the owner, BCC admin', receipt && receipt.bcc?.includes(ADMIN_EMAIL) && receipt.text.includes('10,00'));
  const p2 = await admin.req('POST', '/api/admin', { action: 'payment.create', business_id: bizRow.id, amount: '29', kind: 'plan', plan_key: 'pro', months: '1', method: 'whatsapp', status: 'paid' });
  const plan2 = await planOf();
  check('paid Pro payment sets plan Pro for 1 month and unlocks the rest', p2.status === 200 && plan2.p === 'pro' && (await lockedCount()) === 0 && Math.abs(new Date(plan2.e) - Date.now() - 30 * 86400e3) < 3 * 86400e3, JSON.stringify(p2.data));
  const p3 = await admin.req('POST', '/api/admin', { action: 'payment.create', business_id: bizRow.id, amount: '20', kind: 'lead', lead_credits: '2', method: 'bank', status: 'unpaid' });
  check('unpaid payment changes nothing', p3.status === 200 && (await credits()) === 0);
  const pay3 = (await db.query("select id from payments where business_id = $1 and status = 'unpaid'", [bizRow.id])).rows[0];
  check('marking it paid adds 2 credits', (await admin.req('POST', '/api/admin', { action: 'payment.paid', id: pay3.id })).status === 200 && (await credits()) === 2);
  check('marking it unpaid again removes them', (await admin.req('POST', '/api/admin', { action: 'payment.unpaid', id: pay3.id })).status === 200 && (await credits()) === 0);
  await admin.req('POST', '/api/admin', { action: 'payment.paid', id: pay3.id });
  check('editing a paid payment (2 -> 3 leads) adjusts credits', (await admin.req('POST', '/api/admin', { action: 'payment.update', id: pay3.id, business_id: bizRow.id, amount: '30', kind: 'lead', lead_credits: '3', method: 'bank', status: 'paid' })).status === 200 && (await credits()) === 3);
  check('deleting the payment reverts its credits', (await admin.req('POST', '/api/admin', { action: 'payment.delete', id: pay3.id })).status === 200 && (await credits()) === 0);
  const totals = (await db.query("select coalesce(sum(amount_cents),0)::int s from payments where business_id = $1 and status = 'paid'", [bizRow.id])).rows[0].s;
  check('ledger totals: €39 paid for this business', totals === 3900);
  // a credit is used automatically when a new lead arrives over the limit (only while pricing is on)
  await admin.req('POST', '/api/admin', { action: 'business.plan', id: bizRow.id, plan: 'free' });
  await admin.req('POST', '/api/admin', { action: 'business.credits', id: bizRow.id, credits: '1' });
  const rq = await res.req('POST', '/api/requests', form({ category: 'Schilder', description: 'Graag de kozijnen laten schilderen, ongeveer 6 ramen.', postcode: '1421AB', preferredTiming: 'Binnen een maand', urgency: 'flexible' }));
  const newLead = rq.data?.id ? (await db.query('select status, counts_toward_limit from leads where request_id = $1 and business_id = $2', [rq.data.id, bizRow.id])).rows[0] : null;
  if (PRICING) check('over the limit, a new lead uses a credit instead of locking', rq.status === 201 && newLead?.status === 'new' && newLead?.counts_toward_limit === false && (await credits()) === 0, JSON.stringify({ rq: rq.data, newLead }));
  else check('pricing off: a new lead over the old limit is delivered without using a credit', rq.status === 201 && newLead?.status === 'new' && (await credits()) === 1, JSON.stringify({ rq: rq.data, newLead }));
  const confirmMail = await waitFor(() => sent.find((m) => m.to?.includes(res.email) && /geplaatst/i.test(m.subject)));
  check('resident gets a request confirmation email', Boolean(confirmMail));

  // ---------- 6. Contact form, auto-reply, admin reply, issues
  const n5 = sent.length;
  const contact = await anon.req('POST', '/api/contact', form({ name: 'Piet Bezoeker', email: `piet-${run}@test.uithoorn.invalid`, subject: 'Vraag', message: 'Hoe kan ik mijn bedrijf aanmelden?', lang: 'nl' }));
  check('contact form accepted', contact.status === 201);
  const auto = await waitFor(() => sent.slice(n5).find((m) => m.to?.includes(`piet-${run}@test.uithoorn.invalid`)));
  check('contact auto-reply sent, BCC admin', auto && auto.bcc?.includes(ADMIN_EMAIL));
  const alert = await waitFor(() => sent.slice(n5).find((m) => m.to?.includes(ADMIN_EMAIL) && /contactbericht/i.test(m.subject)));
  check('admin alert for new contact message goes to the admin', Boolean(alert));
  const reply = await admin.req('POST', '/api/admin', { action: 'contact.reply', kind: 'form', id: contact.data.id, subject: 'Re: Vraag', body: 'Via de knop Aanmelden.' });
  check('admin replies to a contact message (sent via Resend)', reply.status === 200 && sent.some((m) => m.subject === 'Re: Vraag' && m.to?.includes(`piet-${run}@test.uithoorn.invalid`)));
  check('reply marks the message handled', (await db.query('select status from contact_messages where id = $1', [contact.data.id])).rows[0].status === 'handled');
  const toIssue = await admin.req('POST', '/api/admin', { action: 'contact.to_issue', kind: 'form', id: contact.data.id });
  const issue = (await db.query('select id, status, source from issues where contact_message_id = $1', [contact.data.id])).rows[0];
  check('contact message turned into an issue', toIssue.status === 200 && issue?.source === 'contact');
  check('issue status update', (await admin.req('POST', '/api/admin', { action: 'issue.status', id: issue.id, status: 'closed' })).status === 200 && (await db.query('select closed_at from issues where id = $1', [issue.id])).rows[0].closed_at !== null);
  check('issue delete', (await admin.req('POST', '/api/admin', { action: 'issue.delete', id: issue.id })).status === 200);

  // ---------- 7. Inbound email webhook
  const sign = (body, secret = SECRET, id = `msg_${Math.random().toString(36).slice(2)}`, ts = Math.floor(Date.now() / 1000)) => {
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`, 'content-type': 'application/json' };
  };
  const evt = (to, id) => JSON.stringify({ type: 'email.received', created_at: new Date().toISOString(), data: { email_id: id, from: 'jan.klant@example.org', to: [to], subject: 'Vraag over mijn vermelding' } });
  const post = (body, headers) => fetch(`${BASE}/api/email/inbound`, { method: 'POST', body, headers }).then((r) => r.status);
  const b1 = evt('info@uithoorn.online', `in_${run}`);
  check('inbound webhook without signature is refused (401)', (await post(b1, { 'content-type': 'application/json' })) === 401);
  check('inbound webhook with a wrong secret is refused (401)', (await post(b1, sign(b1, 'whsec_d3Jvbmctc2VjcmV0'))) === 401);
  check('inbound webhook with a stale timestamp is refused (401)', (await post(b1, sign(b1, SECRET, 'msg_old', Math.floor(Date.now() / 1000) - 3600))) === 401);
  const n6 = sent.length;
  check('signed inbound email accepted (200)', (await post(b1, sign(b1))) === 200);
  const stored = (await db.query('select id, from_address, subject, text_body from inbound_emails where provider_id = $1', [`in_${run}`])).rows[0];
  check('inbound email stored in Contacts with its body', stored && stored.text_body.includes('openingstijden'));
  const fwd = await waitFor(() => sent.slice(n6).find((m) => m.to?.includes(ADMIN_EMAIL) && m.subject.startsWith('[Inbox]')));
  check('inbound email forwarded to the admin with Reply-To the sender', fwd && fwd.reply_to === 'jan.klant@example.org');
  check('duplicate webhook delivery stores nothing new', (await post(b1, sign(b1))) === 200 && Number((await db.query('select count(*) n from inbound_emails where provider_id = $1', [`in_${run}`])).rows[0].n) === 1);
  await wait(300);
  check('…and is not forwarded twice', sent.slice(n6).filter((m) => m.subject.startsWith('[Inbox]')).length === 1);
  const b2 = evt('someone@other-domain.example', `in2_${run}`);
  check('mail for another domain on the account is ignored', (await post(b2, sign(b2))) === 200 && Number((await db.query('select count(*) n from inbound_emails where provider_id = $1', [`in2_${run}`])).rows[0].n) === 0);
  const contacts = await admin.req('GET', `/admin?tab=contacts&source=email`);
  check('inbound email listed in admin Contacts', contacts.status === 200 && String(contacts.data).includes('Vraag over mijn vermelding'));

  // ---------- 8. Email log and the admin-copy rule
  const log = (await db.query("select count(*) filter (where bcc_address = $1)::int as bcc, count(*) filter (where provider_id like 'mock_%')::int as ids from email_outbox where created_at > now() - interval '30 minutes'", [ADMIN_EMAIL])).rows[0];
  check('email_log rows carry the admin BCC and the Resend id', log.bcc > 5 && log.ids > 5, JSON.stringify(log));
  const nonAdmin = sent.filter((m) => !m.to?.includes(ADMIN_EMAIL) && !(m.bcc || []).includes(ADMIN_EMAIL));
  check('every outgoing email reached the admin (To or BCC)', nonAdmin.length === 0, nonAdmin.map((m) => m.subject).join(' | '));
  check('every email has HTML and text versions', sent.every((m) => m.html && m.text && m.html.includes('<html')));

  // ---------- 9. User admin: suspend + delete
  const res2Login = new Client('r2'); await res2Login.req('POST', '/api/auth/login', { email: res2.email, password: res2.password });
  check('admin suspends a user -> their session ends', (await admin.req('POST', '/api/admin', { action: 'user.suspend', id: res2Id })).status === 200 && (await res2Login.req('GET', '/api/auth/me')).data?.user == null);
  check('suspended user cannot log in', (await new Client('r2b').req('POST', '/api/auth/login', { email: res2.email, password: res2.password })).status === 401);
  check('delete without the right confirmation is refused', (await admin.req('POST', '/api/admin', { action: 'user.delete', id: res2Id, confirm: 'wrong@example.com' })).status === 400);
  check('delete with the email as confirmation works', (await admin.req('POST', '/api/admin', { action: 'user.delete', id: res2Id, confirm: res2.email })).status === 200 && (await db.query('select 1 from users where id = $1', [res2Id])).rowCount === 0);
  const adminId = (await db.query('select id from users where email = $1', [admin.email])).rows[0].id;
  check('admin cannot delete or suspend themselves', (await admin.req('POST', '/api/admin', { action: 'user.delete', id: adminId, confirm: admin.email })).status === 400 && (await admin.req('POST', '/api/admin', { action: 'user.suspend', id: adminId })).status === 400);
} finally {
  // Clean up everything this run created.
  await db.query(`delete from users where email like $1`, [`%-${run}@test.uithoorn.invalid`]).catch(() => undefined);
  await db.query(`delete from inbound_emails where provider_id like $1`, [`%_${run}`]).catch(() => undefined);
  await db.query('delete from rate_limits').catch(() => undefined);
  await db.end(); mock.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
