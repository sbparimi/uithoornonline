import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { requireUser, destroyAllSessions, createSession } from '@/lib/auth/session';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password';
import { findUserByEmail, setPassword } from '@/lib/data/users';
import { LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { after } from 'next/server';
import { sendEmail } from '@/lib/email/send';
import { passwordChangedEmail } from '@/lib/email/templates';

export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const limit = await rateLimit('account-action', user.id, LIMITS.accountAction);
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const next = String(body.newPassword ?? '');
    const problem = passwordProblem(next);
    if (problem) return errorJson(problem, 400);
    const row = await findUserByEmail(user.email);
    // Current password required, unless the user just signed in with an email link (the reset path).
    const viaFreshLink = user.authMethod === 'email_link' && user.sessionAgeSeconds < 30 * 60;
    if (row?.password_hash && !viaFreshLink && !(await verifyPassword(String(body.currentPassword ?? ''), row.password_hash))) return errorJson('invalid_current_password', 403);
    await setPassword(user.id, await hashPassword(next));
    await destroyAllSessions(user.id);
    await createSession(user.id, 'password');
    const lang = row?.locale ?? 'nl';
    after(() => sendEmail({ to: user.email, kind: 'password_changed', lang, ...passwordChangedEmail(lang) }));
    return json({ ok: true });
  }, 'account/password');
}
