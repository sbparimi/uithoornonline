import { errorJson, handle, json, readJson, sameOrigin, str } from '@/lib/http';
import { clientIp, LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { looksLikeSpam } from '@/lib/security/spam';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { createUser, normalizeEmail } from '@/lib/data/users';
import { cleanBusinessInput, createBusinessForOwner } from '@/lib/data/businesses';
import { sendEmail } from '@/lib/email/send';
import { welcomeEmail } from '@/lib/email/templates';
import { notify } from '@/lib/notify';
import { query } from '@/lib/db';
import { after } from 'next/server';

export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const body = await readJson(request);
    if (looksLikeSpam(body)) return errorJson('rejected', 400);
    const limit = await rateLimit('signup-ip', clientIp(request), LIMITS.signupIp);
    if (!limit.ok) return errorJson('rate_limited', 429, { retryAfter: limit.retryAfter }, { 'Retry-After': String(limit.retryAfter) });

    const email = normalizeEmail(body.email);
    const password = String(body.password ?? '');
    const fullName = str(body.fullName ?? body.name, 120);
    const phone = str(body.phone, 40) || null;
    const role = body.role === 'provider' ? 'provider' : 'customer';
    const locale = body.lang === 'en' ? 'en' : 'nl';
    if (!email) return errorJson('invalid_email', 400);
    const problem = passwordProblem(password);
    if (problem) return errorJson(problem, 400);
    if (fullName.length < 2) return errorJson('invalid_name', 400);
    if (body.acceptTerms !== true && body.acceptTerms !== 'true' && body.acceptTerms !== 'on') return errorJson('terms_required', 400);

    let business: ReturnType<typeof cleanBusinessInput>['value'] | null = null;
    if (role === 'provider') {
      const cleaned = cleanBusinessInput({ name: body.businessName ?? body.business, category: body.businessCategory ?? body.category, description: body.businessDescription ?? body.description, postcode: body.postcode, website: body.website, phone: body.phone });
      if (cleaned.error) return errorJson(cleaned.error, 400);
      if (!cleaned.value.name || !cleaned.value.category) return errorJson('invalid_business', 400);
      if ((cleaned.value.description ?? '').length < 20) return errorJson('invalid_description', 400);
      business = cleaned.value;
    }

    const created = await createUser({ email, passwordHash: await hashPassword(password), fullName, phone, role, locale });
    if (!created) return errorJson('email_exists', 409);
    let businessId: string | null = null;
    if (business) {
      try {
        businessId = await createBusinessForOwner(created.id, { ...business, name: business.name!, category: business.category! });
      } catch (error) {
        // Keep signup all-or-nothing: no provider account without its business.
        await query('delete from users where id = $1', [created.id]).catch(() => undefined);
        throw error;
      }
    }
    await createSession(created.id, 'password');

    const mail = welcomeEmail(locale, fullName, role === 'provider');
    after(() => sendEmail({ to: email, kind: 'welcome', lang: locale, ...mail }));
    after(() => notify(role === 'provider' ? 'new_business' : 'new_signup', role === 'provider' ? `${business!.name} (${business!.category})` : `${fullName} (bewoner)`, { email, role, businessId }));
    return json({ ok: true, role, redirect: locale === 'en' ? (role === 'provider' ? '/en/provider' : '/en/account') : (role === 'provider' ? '/provider' : '/account') }, 201);
  }, 'auth/signup');
}
