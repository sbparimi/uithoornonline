#!/usr/bin/env node
// Launch-readiness regression tests (headers, SEO files, XSS, redirects, email privacy, input caps)
// with REAL HTTP requests against a running instance on a LOCAL database, Resend replaced by a mock.
//   Start the app with RESEND_API_KEY=test RESEND_API_URL=http://127.0.0.1:3999 (and a local DATABASE_URL),
//   then: BASE_URL=http://localhost:3000 DATABASE_URL=postgres://... node scripts/launch-test.mjs
// Never run against production: it creates and deletes test accounts.
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url || /neon\.tech/.test(url)) { console.error('Set DATABASE_URL to a LOCAL database (refusing Neon).'); process.exit(1); }
const db = new pg.Client({ connectionString: url });
await db.connect();

const sent = [];
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/emails') { sent.push(JSON.parse(body || '{}')); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: `mock_${sent.length}` })); return; }
    res.writeHead(404); res.end('{}');
  });
});
await new Promise((r) => mock.listen(3999, '127.0.0.1', r));

const results = [];
function check(name, ok, detail = '') { results.push({ name, ok: Boolean(ok) }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); }
let ip = 50;
const nextIp = () => `198.51.100.${ip++}`;
async function req(path, { method = 'GET', headers = {}, body, cookie } = {}) {
  const h = { 'x-forwarded-for': nextIp(), ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined && typeof body !== 'string') { h['content-type'] = 'application/json'; body = JSON.stringify(body); }
  if (method !== 'GET') h.origin = BASE;
  return fetch(`${BASE}${path}`, { method, headers: h, body, redirect: 'manual' });
}
// Same raw-HTTP path for Host-header tests (fetch does not let a caller override Host).
function rawGet(path, host) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', headers: { host } }, (res) => { res.resume(); resolve({ status: res.statusCode, headers: res.headers }); });
    r.on('error', reject); r.end();
  });
}
// The public forms carry a fill timer (anti-spam); a real form sends it, so the tests do too.
const human = () => ({ form_started_at: Date.now() - 8000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const run = Date.now().toString(36);
const emails = [];

try {
  // 1. Security headers
  const home = await req('/');
  const csp = home.headers.get('content-security-policy') || '';
  check('CSP header present with frame-ancestors none', csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"));
  check('X-Frame-Options DENY', home.headers.get('x-frame-options') === 'DENY');
  check('X-Content-Type-Options nosniff', home.headers.get('x-content-type-options') === 'nosniff');
  check('Referrer-Policy set', (home.headers.get('referrer-policy') || '').includes('strict-origin'));
  check('Permissions-Policy set', (home.headers.get('permissions-policy') || '').includes('camera=()'));
  const api = await req('/api/auth/me');
  check('API responses carry X-Robots-Tag noindex', (api.headers.get('x-robots-tag') || '').includes('noindex'));
  const adm = await req('/admin');
  check('/admin carries X-Robots-Tag noindex', (adm.headers.get('x-robots-tag') || '').includes('noindex'), String(adm.status));

  // 2. Hosts
  const www = await rawGet('/businesses?x=1', 'www.uithoorn.online');
  check('www host redirects 308 to the apex', www.status === 308 && String(www.headers.location || '').startsWith('https://uithoorn.online/businesses?x=1'), `${www.status} ${www.headers.location}`);
  const prev = await rawGet('/', 'uithoornonline-git-x.vercel.app');
  check('non-production host gets X-Robots-Tag noindex', String(prev.headers['x-robots-tag'] || '').includes('noindex'));
  const canon = await rawGet('/', 'uithoorn.online');
  check('production host is indexable', !String(canon.headers['x-robots-tag'] || '').includes('noindex'));

  // 3. Icons, manifest, sitemap
  for (const p of ['/favicon.ico', '/apple-icon.png', '/icons/icon-192.png', '/icons/icon-512.png']) { const r = await req(p); check(`${p} 200`, r.status === 200, String(r.status)); }
  const man = await req('/manifest.webmanifest');
  const manJson = man.status === 200 ? await man.json().catch(() => null) : null;
  check('manifest.webmanifest is valid JSON with icons', manJson?.icons?.length === 2, String(man.status));
  const sm = await (await req('/sitemap.xml')).text();
  check('sitemap lists business profiles', sm.includes('/businesses/15953249-c000-4521-839d-41bf341b6aa8'));
  check('sitemap has x-default and /contact', sm.includes('hreflang="x-default"') && sm.includes('/contact<'));

  // 4. Stored XSS through the business name (JSON-LD)
  const evil = `XSS${run}</script><script>alert(1)</script>`;
  const signup = await req('/api/auth/signup', { method: 'POST', body: { ...human(), email: `xss-${run}@test.uithoorn.invalid`, password: 'Launch-test-12345', fullName: 'Test Owner', role: 'provider', businessName: 'Launch Test Bedrijf', businessCategory: 'Schoonmaak', businessDescription: 'Testbedrijf voor de launch-test, wordt verwijderd.', postcode: '1421AB', acceptTerms: true, lang: 'nl' } });
  emails.push(`xss-${run}@test.uithoorn.invalid`);
  const ck = (signup.headers.get('set-cookie') || '').split(';')[0];
  check('provider signup works', signup.status === 201, String(signup.status));
  const { rows: [biz] } = await db.query("select b.id from businesses b join users u on u.id = b.owner_id where u.email = $1", [`xss-${run}@test.uithoorn.invalid`]);
  await db.query("update businesses set moderation_status = 'approved', active = true where id = $1", [biz.id]);
  const ren = await req('/api/provider/profile', { method: 'PATCH', cookie: ck, body: { name: evil } });
  check('owner can rename the approved business', ren.status === 200, String(ren.status));
  await wait(300);
  const dir = await (await req('/businesses')).text();
  check('directory HTML does not contain the injected </script>', dir.includes(`XSS${run}`) ? !dir.includes(`XSS${run}</script><script>alert(1)`) : true, dir.includes(`XSS${run}`) ? 'name present' : 'name not in this render (cached page)');
  const prof = await (await req(`/businesses/${biz.id}`)).text();
  check('business page JSON-LD escapes "<"', prof.includes('application/ld+json') && !prof.includes(`XSS${run}</script><script>`) && prof.includes(`XSS${run}\\u003c/script`));

  // 5. Strict UUIDs: malformed ids are 404, not 500
  const dashes = await req('/businesses/------------------------------------');
  check('malformed business id answers 404', dashes.status === 404, String(dashes.status));
  const an = await req('/api/analytics', { method: 'POST', body: { eventName: 'profile_view', businessId: '------------------------------------' } });
  check('analytics with a malformed id does not 500', an.status !== 500, String(an.status));

  // 6. Body size cap
  const big = await req('/api/contact', { method: 'POST', body: { ...human(), name: 'Big', email: 'big@test.uithoorn.invalid', message: 'x'.repeat(100_000) } });
  check('a 100 KB body is refused with 413', big.status === 413, String(big.status));

  // 7. Contact auto-reply does not echo what the sender typed
  sent.length = 0;
  const marker = `https://phish-${run}.example/login`;
  const c = await req('/api/contact', { method: 'POST', body: { ...human(), name: `Win ${marker}`, email: `contact-${run}@test.uithoorn.invalid`, subject: 'Test', message: `Klik hier: ${marker} om je prijs op te halen.` } });
  check('contact form accepted', c.status === 201, String(c.status));
  await wait(1500);
  const auto = sent.find((m) => [].concat(m.to).includes(`contact-${run}@test.uithoorn.invalid`));
  check('auto-reply was sent to the sender', Boolean(auto));
  check('auto-reply does not contain the sender\'s text', auto && !JSON.stringify(auto).includes(`phish-${run}`));

  // 8. Reset links are never copied to the admin
  const custEmail = `reset-${run}@test.uithoorn.invalid`;
  emails.push(custEmail);
  await req('/api/auth/signup', { method: 'POST', body: { ...human(), email: custEmail, password: 'Launch-test-12345', fullName: 'Reset Test', role: 'customer', acceptTerms: true, lang: 'nl' } });
  sent.length = 0;
  const rr = await req('/api/auth/password-reset', { method: 'POST', body: { email: custEmail, lang: 'nl' } });
  check('password reset accepted', rr.status === 200, String(rr.status));
  await wait(1500);
  const resetMail = sent.find((m) => [].concat(m.to).includes(custEmail) && /wachtwoord/i.test(m.subject || ''));
  check('reset email sent to the user', Boolean(resetMail));
  check('reset email has no admin BCC', resetMail && !(resetMail.bcc && [].concat(resetMail.bcc).length), JSON.stringify(resetMail && { to: resetMail.to, bcc: resetMail.bcc, subject: resetMail.subject }));
  sent.length = 0;
  const ml = await req('/api/auth/magic-link', { method: 'POST', body: { email: custEmail, lang: 'nl' } });
  check('magic link accepted', ml.status === 200, String(ml.status));
  await wait(1500);
  const loginMail = sent.find((m) => [].concat(m.to).includes(custEmail) && /inloglink/i.test(m.subject || ''));
  check('sign-in link email has no admin BCC', loginMail && !(loginMail.bcc && [].concat(loginMail.bcc).length));

  // 9. Magic-link callback: purpose check and safe redirect
  const mk = async (purpose) => { const t = randomBytes(32).toString('base64url'); await db.query("insert into auth_tokens(token_hash, email, purpose, expires_at) values ($1, $2, $3, now() + interval '10 minutes')", [createHash('sha256').update(t).digest('hex'), custEmail, purpose]); return t; };
  const resetTok = await mk('reset');
  const cb1 = await req(`/auth/callback?token=${encodeURIComponent(resetTok)}`);
  check('a reset token cannot sign in through /auth/callback', (cb1.headers.get('location') || '').includes('error=link_invalid'), cb1.headers.get('location'));
  const loginTok = await mk('login');
  const cb2 = await req(`/auth/callback?token=${encodeURIComponent(loginTok)}&next=${encodeURIComponent('/\\evil.example')}`);
  const loc = cb2.headers.get('location') || '';
  check('backslash next= is not followed (no open redirect)', cb2.status >= 300 && cb2.status < 400 && new URL(loc, BASE).host === new URL(BASE).host && !loc.includes('evil'), loc);
} catch (error) {
  check('launch test crashed', false, error instanceof Error ? error.stack : String(error));
} finally {
  for (const e of emails) await db.query('delete from users where email = $1', [e]).catch(() => undefined);
  await db.query("delete from contact_messages where email like 'contact-%@test.uithoorn.invalid' or email = 'big@test.uithoorn.invalid'").catch(() => undefined);
  await db.end(); mock.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
