import { after } from 'next/server';
import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { createAuthToken, RESET_TOKEN_MINUTES } from '@/lib/auth/tokens';
import { emailConfigured, sendEmail } from '@/lib/email/send';
import { localPath, passwordResetEmail, siteUrl } from '@/lib/email/templates';
import { findUserByEmail, normalizeEmail } from '@/lib/data/users';

// "Forgot password": emails a one-time, expiring (60 min), single-use link to /reset-password.
// The answer is identical whether or not the account exists (no account enumeration), and the
// lookup + email happen after the response so timing does not reveal it either.
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    if (!emailConfigured()) return errorJson('email_not_configured', 503);
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const lang = body.lang === 'en' ? 'en' : 'nl';
    if (!email) return errorJson('invalid_email', 400);
    const ip = await rateLimit('reset-ip', clientIp(request), LIMITS.resetIp);
    const perEmail = await rateLimit('reset-email', email, LIMITS.resetEmail);
    if (!ip.ok || !perEmail.ok) return errorJson('rate_limited', 429, { retryAfter: Math.max(ip.retryAfter, perEmail.retryAfter) });
    after(async () => {
      const user = await findUserByEmail(email);
      if (!user || user.disabled_at) return;
      const userLang = user.locale ?? lang;
      const token = await createAuthToken(email, 'reset', RESET_TOKEN_MINUTES);
      const url = `${siteUrl()}${localPath(userLang, '/reset-password')}?token=${encodeURIComponent(token)}`;
      await sendEmail({ to: email, kind: 'password_reset', lang: userLang, ...passwordResetEmail(userLang, url, RESET_TOKEN_MINUTES) });
    });
    return json({ ok: true });
  }, 'auth/password-reset');
}
