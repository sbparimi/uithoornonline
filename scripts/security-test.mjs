#!/usr/bin/env node
// End-to-end authorization & abuse tests with REAL HTTP requests against a running instance.
//   BASE_URL=http://localhost:3000 DATABASE_URL=postgres://... node scripts/security-test.mjs
// DATABASE_URL is used only to promote the test admin (there is no web path to become admin)
// and to clean up the test accounts afterwards. Safe against a preview; never run on production.
import pg from 'pg';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is required'); process.exit(1); }
const db = new pg.Client({ connectionString: url, ssl: /neon\.tech/.test(url) && !/sslmode=/.test(url) ? true : undefined });
await db.connect();

const run = Date.now().toString(36);
const results = [];
let ipCounter = 10;
function check(name, condition, detail = '') { results.push({ name, ok: Boolean(condition), detail }); console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); }

class Client {
  constructor(label) { this.label = label; this.cookie = ''; this.ip = `203.0.113.${ipCounter++}`; }
  async req(method, path, body, extraHeaders = {}) {
    const headers = { 'x-forwarded-for': this.ip, accept: 'application/json', ...extraHeaders };
    if (this.cookie) headers.cookie = this.cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) { const [pair] = c.split(';'); if (pair.startsWith('uo_session=')) this.cookie = pair.endsWith('=') ? '' : pair; }
    let data = null; const text = await res.text(); try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
}
const started = () => Date.now() - 5000;
const form = (extra) => ({ form_started_at: started(), company_website: '', ...extra });

async function signup(c, role, extra = {}) {
  const email = `${c.label}-${run}@test.uithoorn.invalid`;
  c.email = email;
  const r = await c.req('POST', '/api/auth/signup', form({ email, password: 'correct-horse-battery', fullName: `Test ${c.label}`, phone: '+31600000000', role, acceptTerms: true, ...extra }));
  return r;
}

try {
  const anon = new Client('anon');
  const residentA = new Client('resA');
  const residentB = new Client('resB');
  const biz = new Client('biz');
  const admin = new Client('admin');

  // --- Removed / locked endpoints
  check('/api/agent is gone (404)', (await anon.req('POST', '/api/agent', { message: 'hi' })).status === 404);
  check('anonymous cannot post a request (401)', (await anon.req('POST', '/api/requests', form({ category: 'tuin', description: 'test test test', postcode: '1421AB', preferredTiming: 'asap' }))).status === 401);
  check('anonymous cannot read admin data (401)', (await anon.req('GET', '/api/admin?section=users')).status === 401);

  // --- Spam protection
  check('honeypot filled -> rejected', (await anon.req('POST', '/api/contact', { name: 'Bot', email: 'bot@example.com', message: 'buy cheap stuff now!!', company_website: 'http://spam', form_started_at: started() })).status === 400);
  check('form submitted too fast -> rejected', (await anon.req('POST', '/api/contact', { name: 'Bot', email: 'bot@example.com', message: 'buy cheap stuff now!!', form_started_at: Date.now() })).status === 400);
  const contact = await anon.req('POST', '/api/contact', form({ name: 'Echte Bezoeker', email: `visitor-${run}@test.uithoorn.invalid`, subject: 'Vraag', message: 'Hallo, ik heb een vraag over de site.' }));
  check('genuine contact message accepted (201)', contact.status === 201, `status ${contact.status}`);

  // --- Signup
  check('signup without accepting terms is refused', (await new Client('noterms').req('POST', '/api/auth/signup', form({ email: `nt-${run}@test.uithoorn.invalid`, password: 'correct-horse-battery', fullName: 'No Terms', role: 'customer' }))).status === 400);
  const sa = await signup(residentA, 'customer');
  check('resident A signs up (201)', sa.status === 201, JSON.stringify(sa.data));
  check('resident B signs up (201)', (await signup(residentB, 'customer')).status === 201);
  const sb = await signup(biz, 'provider', { businessName: `Tuinbedrijf Test ${run}`, businessCategory: 'Tuin & buiten', businessDescription: 'Tuinonderhoud, bestrating en schuttingen in Uithoorn en De Kwakel.', postcode: '1421AB' });
  check('business signs up (201)', sb.status === 201, JSON.stringify(sb.data));
  check('signup can NOT create an admin (role=admin -> resident)', (await (async () => { const c = new Client('sneaky'); await signup(c, 'admin'); const me = await c.req('GET', '/api/auth/me'); return me.data?.user?.role === 'customer'; })()));
  check('duplicate email refused (409)', (await residentA.req('POST', '/api/auth/signup', form({ email: residentA.email, password: 'correct-horse-battery', fullName: 'Dup', role: 'customer', acceptTerms: true }))).status === 409);

  // admin via DB (the only way)
  await signup(admin, 'customer');
  await db.query(`update users set role = 'admin' where email = $1`, [admin.email]);

  // --- Login
  const wrong = await new Client('x').req('POST', '/api/auth/login', { email: residentA.email, password: 'wrong-password-123' });
  check('wrong password refused (401)', wrong.status === 401);
  const login = new Client('resA2');
  const lr = await login.req('POST', '/api/auth/login', { email: residentA.email, password: 'correct-horse-battery' });
  check('resident logs in with password', lr.status === 200 && login.cookie !== '', `status ${lr.status}`);

  // --- Hole 1: self-promotion to admin
  const promo = await residentA.req('PATCH', '/api/account/profile', { fullName: 'Resident A', role: 'admin' });
  const meA = await residentA.req('GET', '/api/auth/me');
  check('resident cannot make themselves admin via profile update', promo.status === 200 && meA.data?.user?.role === 'customer', `role=${meA.data?.user?.role}, ignored=${JSON.stringify(promo.data?.ignored)}`);
  check('resident cannot call admin API (403)', (await residentA.req('POST', '/api/admin', { action: 'user.role', id: '00000000-0000-0000-0000-000000000000', role: 'admin' })).status === 403);
  check('resident cannot list users (403)', (await residentA.req('GET', '/api/admin?section=users')).status === 403);
  check('business cannot list users (403)', (await biz.req('GET', '/api/admin?section=users')).status === 403);
  check('admin can list users (200)', (await admin.req('GET', '/api/admin?section=users')).status === 200);

  // --- Hole 3: business cannot verify/feature/approve itself
  const self = await biz.req('PATCH', '/api/provider/profile', { description: 'Tuinonderhoud, bestrating, schuttingen en snoeiwerk in Uithoorn.', verified: true, featured: true, moderation_status: 'approved', active: true });
  const bizRow = (await db.query(`select b.id, b.verified, b.featured, b.moderation_status from businesses b join users u on u.id = b.owner_id where u.email = $1`, [biz.email])).rows[0];
  check('business cannot set itself verified/featured/approved', self.status === 200 && !bizRow.verified && !bizRow.featured && bizRow.moderation_status === 'pending', JSON.stringify({ ...bizRow, ignored: self.data?.ignored }));
  check('resident cannot use the business profile API (403)', (await residentA.req('PATCH', '/api/provider/profile', { name: 'Hijack' })).status === 403);
  check('business cannot approve itself via admin API (403)', (await biz.req('POST', '/api/admin', { action: 'business.approve', id: bizRow.id })).status === 403);

  // --- Pending business gets no leads; approval by admin
  const r0 = await residentA.req('POST', '/api/requests', form({ category: 'tuin onderhoud', description: 'Mijn tuin moet gesnoeid worden, graag een offerte.', postcode: '1421AB', preferredTiming: 'Deze week', urgency: 'soon' }));
  check('resident posts a request (201)', r0.status === 201, JSON.stringify(r0.data));
  check('pending (unapproved) business receives no lead', r0.data?.matched === 0);
  const appr = await admin.req('POST', '/api/admin', { action: 'business.approve', id: bizRow.id });
  check('admin approves the business', appr.status === 200);
  await admin.req('POST', '/api/admin', { action: 'business.flags', id: bizRow.id, verified: true });

  // --- Business receives a lead
  const r1 = await residentA.req('POST', '/api/requests', form({ category: 'tuin bestrating', description: 'Graag nieuwe bestrating in de achtertuin, ongeveer 20 m2.', postcode: '1421AB', preferredTiming: 'Binnen een maand', urgency: 'flexible' }));
  check('approved business is matched', r1.status === 201 && r1.data?.matched === 1, JSON.stringify(r1.data));
  const leads = await biz.req('GET', '/api/provider/leads');
  const lead = leads.data?.leads?.find((l) => l.request_id === r1.data?.id);
  check('business sees the lead with request details', leads.status === 200 && lead && lead.description?.includes('bestrating'));
  check("lead never exposes the resident's email or phone", lead && !JSON.stringify(leads.data).includes(residentA.email) && !JSON.stringify(leads.data).includes('+31600000000'));
  const outbox = (await db.query(`select status from email_outbox where kind = 'new_lead' and to_address = $1`, [biz.email])).rows;
  check('new-lead email attempted for the business (outbox row)', outbox.length >= 1, outbox.map((o) => o.status).join(','));
  const owner = (await db.query(`select count(*)::int n from email_outbox where kind = 'notify:new_request' and to_address = 'uithoorn.online@mail.tab.bot'`)).rows[0].n;
  check('owner notification for new request attempted (to uithoorn.online@mail.tab.bot)', owner >= 1);
  check('resident cannot read business leads (403)', (await residentA.req('GET', '/api/provider/leads')).status === 403);

  // --- Hole 2: no reading other people's requests / conversations
  const acc = await biz.req('POST', `/api/provider/requests/${r1.data.id}/accept`);
  check('business accepts the lead -> conversation', acc.status === 200 && acc.data?.conversationId, JSON.stringify(acc.data));
  const conv = acc.data?.conversationId;
  check('business sends a message', (await biz.req('POST', `/api/conversations/${conv}/messages`, { body: 'Hallo! Wanneer kan ik langskomen?' })).status === 201);
  const readA = await residentA.req('GET', `/api/conversations/${conv}/messages`);
  check('resident A reads the business message', readA.status === 200 && readA.data?.messages?.length === 1);
  check('resident B cannot read A\'s conversation (404)', (await residentB.req('GET', `/api/conversations/${conv}/messages`)).status === 404);
  check('resident B cannot post into A\'s conversation', (await residentB.req('POST', `/api/conversations/${conv}/messages`, { body: 'hi' })).status === 403);
  check('anonymous cannot read the conversation (401)', (await anon.req('GET', `/api/conversations/${conv}/messages`)).status === 401);
  const bizAcceptOther = await biz.req('POST', `/api/provider/requests/${r0.data.id}/accept`);
  check('business cannot accept a request it was not matched to', bizAcceptOther.status === 403);
  const exportB = await residentB.req('GET', '/api/account/export');
  check("resident B's export contains none of A's data", exportB.status === 200 && !JSON.stringify(exportB.data).includes('bestrating') && !JSON.stringify(exportB.data).includes(residentA.email));

  // --- Review after completion; admin hides it
  check('resident cannot review before completion', (await residentA.req('POST', '/api/reviews', { conversationId: conv, rating: 5, body: 'Top' })).status === 403);
  await residentA.req('POST', `/api/conversations/${conv}/complete`);
  const rev = await residentA.req('POST', '/api/reviews', { conversationId: conv, rating: 5, body: 'Snel en netjes gewerkt.' });
  check('resident reviews after completion (201)', rev.status === 201);
  check('resident B cannot review A\'s job', (await residentB.req('POST', '/api/reviews', { conversationId: conv, rating: 1, body: 'nep' })).status === 403);
  check('admin hides a review', (await admin.req('POST', '/api/admin', { action: 'review.hide', id: rev.data.id, note: 'test' })).status === 200);
  check('admin hides a request', (await admin.req('POST', '/api/admin', { action: 'request.hide', id: r0.data.id, note: 'test' })).status === 200);

  // --- Lead limits (Free = 3 per month)
  const residents = [residentA, residentB];
  for (let i = 0; i < 3; i++) {
    const who = residents[i % 2];
    await who.req('POST', '/api/requests', form({ category: 'tuin schutting', description: `Nieuwe schutting nodig, verzoek nummer ${i + 2}.`, postcode: '1422AA', preferredTiming: 'Flexibel', urgency: 'flexible' }));
  }
  const leads2 = await biz.req('GET', '/api/provider/leads');
  const locked = leads2.data?.leads?.filter((l) => l.status === 'locked') ?? [];
  check('Free plan: 4th lead this month is locked (limit 3)', leads2.data?.usage?.includedLeads === 3 && leads2.data?.usage?.usedThisMonth === 3 && locked.length === 1, JSON.stringify(leads2.data?.usage));
  check('locked lead hides the request details', locked[0] && locked[0].description === null && locked[0].postcode === null);
  check('business cannot accept a locked lead (402)', locked[0] && (await biz.req('POST', `/api/provider/requests/${locked[0].request_id}/accept`)).status === 402);
  const plan = await admin.req('POST', '/api/admin', { action: 'business.plan', id: bizRow.id, plan: 'pro', note: 'test: betaald via Tikkie' });
  check('admin sets plan Pro -> locked lead unlocked', plan.status === 200 && plan.data?.result?.unlocked === 1, JSON.stringify(plan.data));
  const leads3 = await biz.req('GET', '/api/provider/leads');
  check('Pro plan shows 15 included leads', leads3.data?.usage?.includedLeads === 15 && !leads3.data.leads.some((l) => l.status === 'locked'));

  // --- Admin safety
  const adminId = (await db.query('select id from users where email = $1', [admin.email])).rows[0].id;
  check('admin cannot demote themselves', (await admin.req('POST', '/api/admin', { action: 'user.role', id: adminId, role: 'customer' })).status === 400);

  // --- Rate limiting
  const attacker = new Client('attacker');
  let last = 0;
  for (let i = 0; i < 10; i++) last = (await attacker.req('POST', '/api/auth/login', { email: residentA.email, password: `guess-${i}-xxxxxx` })).status;
  check('login brute force is rate limited (429)', last === 429, `last status ${last}`);

  // --- Account deletion
  const del = await residentB.req('POST', '/api/account/delete', { confirmEmail: residentB.email });
  check('resident deletes their account', del.status === 200);
  const gone = (await db.query('select count(*)::int n from users where email = $1', [residentB.email])).rows[0].n;
  check('deleted account is gone from the database', gone === 0);
  check('deleted account can no longer log in', (await new Client('relog').req('POST', '/api/auth/login', { email: residentB.email, password: 'correct-horse-battery' })).status === 401);
} catch (error) {
  check('test run completed without exceptions', false, error instanceof Error ? error.stack : String(error));
} finally {
  await db.query(`delete from users where email like $1`, [`%-${run}@test.uithoorn.invalid`]).catch(() => undefined);
  await db.query(`delete from contact_messages where email like $1`, [`%-${run}@test.uithoorn.invalid`]).catch(() => undefined);
  await db.end();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
