import { after } from 'next/server';
import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { consumeAuthTokenFor, revokeAuthTokens } from '@/lib/auth/tokens';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { createSession, destroyAllSessions } from '@/lib/auth/session';
import { findUserByEmail, markEmailVerified, setPassword } from '@/lib/data/users';
import { sendEmail } from '@/lib/email/send';
import { passwordChangedEmail } from '@/lib/email/templates';
import { query } from '@/lib/db';

// Sets a new password with a reset token. The token is consumed first (single use) and must not be
// expired; every other session and outstanding reset link of the account is then invalidated.
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const limit = await rateLimit('reset-confirm-ip', clientIp(request), LIMITS.resetConfirmIp);
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const password = String(body.password ?? '');
    const problem = passwordProblem(password);
    if (problem) return errorJson(problem, 400);
    const token = await consumeAuthTokenFor(String(body.token ?? ''), 'reset');
    if (!token) return errorJson('invalid_or_expired_token', 400);
    const user = await findUserByEmail(token.email);
    if (!user || user.disabled_at) return errorJson('invalid_or_expired_token', 400);
    await setPassword(user.id, await hashPassword(password));
    await markEmailVerified(user.id);
    await revokeAuthTokens(user.email, 'reset');
    await destroyAllSessions(user.id);
    await createSession(user.id, 'password');
    await query("insert into audit_log(actor_id, action, target_type, target_id, details) values ($1, 'password_reset', 'user', $1, '{}')", [user.id]).catch(() => undefined);
    const lang = user.locale ?? 'nl';
    after(() => sendEmail({ to: user.email, kind: 'password_changed', lang, ...passwordChangedEmail(lang) }));
    const home = user.role === 'admin' ? '/admin' : user.role === 'provider' ? '/provider' : '/account';
    return json({ ok: true, redirect: lang === 'en' ? `/en${home}` : home });
  }, 'auth/password-reset/confirm');
}
