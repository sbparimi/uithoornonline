import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { createAuthToken } from '@/lib/auth/tokens';
import { emailConfigured, sendEmail } from '@/lib/email/send';
import { loginLinkEmail, siteUrl } from '@/lib/email/templates';
import { findUserByEmail, normalizeEmail } from '@/lib/data/users';

function safeNext(value: unknown) {
  const v = String(value ?? '');
  return v.startsWith('/') && !v.startsWith('//') && !v.includes('://') ? v.slice(0, 200) : '';
}

// Passwordless sign-in for existing accounts (also the "forgot password" path: sign in by link,
// then set a new password under account settings). Needs RESEND_API_KEY.
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    if (!emailConfigured()) return errorJson('email_not_configured', 503);
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const lang = body.lang === 'en' ? 'en' : 'nl';
    if (!email) return errorJson('invalid_email', 400);
    const ip = await rateLimit('magic-ip', clientIp(request), LIMITS.loginIp);
    const perEmail = await rateLimit('magic-email', email, LIMITS.emailLink);
    if (!ip.ok || !perEmail.ok) return errorJson('rate_limited', 429);
    const user = await findUserByEmail(email);
    // Same answer whether or not the account exists (no account enumeration).
    if (user && !user.disabled_at) {
      const token = await createAuthToken(email, 'login');
      const next = safeNext(body.next);
      const url = `${siteUrl()}/auth/callback?token=${encodeURIComponent(token)}${next ? `&next=${encodeURIComponent(next)}` : ''}`;
      await sendEmail({ to: email, kind: 'login_link', ...loginLinkEmail(user.locale ?? lang, url) });
    }
    return json({ ok: true });
  }, 'auth/magic-link');
}
