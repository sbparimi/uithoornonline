import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, isMobileClient } from '@/lib/auth/session';
import { findUserByEmail, normalizeEmail } from '@/lib/data/users';

export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? '');
    const ipLimit = await rateLimit('login-ip', clientIp(request), LIMITS.loginIp);
    if (!ipLimit.ok) return errorJson('rate_limited', 429, { retryAfter: ipLimit.retryAfter }, { 'Retry-After': String(ipLimit.retryAfter) });
    if (!email || !password) return errorJson('invalid_credentials', 401);
    const emailLimit = await rateLimit('login-email', email, LIMITS.loginEmail);
    if (!emailLimit.ok) return errorJson('rate_limited', 429, { retryAfter: emailLimit.retryAfter }, { 'Retry-After': String(emailLimit.retryAfter) });
    const user = await findUserByEmail(email);
    const valid = await verifyPassword(password, user?.password_hash);
    if (!user || !valid || user.disabled_at) return errorJson('invalid_credentials', 401);
    const token = await createSession(user.id, 'password');
    const en = body.lang === 'en';
    const home = user.role === 'admin' ? '/admin' : user.role === 'provider' ? '/provider' : '/account';
    return json({ ok: true, role: user.role, redirect: en ? `/en${home}` : home, ...(isMobileClient(request) ? { token } : {}) });
  }, 'auth/login');
}
