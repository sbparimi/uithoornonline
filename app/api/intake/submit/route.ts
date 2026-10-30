import { after } from 'next/server';
import { errorJson, handle, json, sameOrigin } from '@/lib/http';
import { getCurrentUser } from '@/lib/auth/session';
import { clientIp, LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { looksLikeSpam } from '@/lib/security/spam';
import { normalizeEmail } from '@/lib/data/users';
import { normalizePhone } from '@/lib/phone';
import { REQUEST_CATEGORIES } from '@/lib/request-options';
import { sendEmail } from '@/lib/email/send';
import { newLeadEmail } from '@/lib/email/templates';
import { notify } from '@/lib/notify';
import { emailAlertsEnabled, intakeEnabled } from '@/lib/urgent/flags';
import { categoryLabel, createIntakeRequest, dispatchInitialAlerts, sendIntakeConfirmation } from '@/lib/urgent/alerts';
import { signToken } from '@/lib/urgent/tokens';
import type { UrgencyLevel } from '@/lib/urgent/llm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 2_600_000; // three ~800 KB photos (the client compresses to well under that)
const LEVELS: UrgencyLevel[] = ['spoed', 'today', 'week', 'flexible'];

function photo(v: unknown): { mime: string; data: Buffer } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(v ?? ''));
  if (!m) return null;
  const data = Buffer.from(m[2], 'base64');
  return data.length > 0 && data.length <= 1_000_000 ? { mime: m[1], data } : null;
}

// Final step of the intake: creates the normal request (same matcher, leads, notifications), alerts the
// matching businesses (one-tap accept emails when JOB_ALERTS_EMAIL_ENABLED=1, else the classic lead
// email), confirms to the customer with a live status link, and starts the spoed clock.
export async function POST(request: Request) {
  return handle(async () => {
    if (!intakeEnabled()) return errorJson('not_enabled', 404);
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return errorJson('payload_too_large', 413);
    const raw = await request.text();
    if (raw.length > MAX_BYTES) return errorJson('payload_too_large', 413);
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(raw); } catch { return errorJson('invalid_request', 400); }
    if (looksLikeSpam(body)) return errorJson('rejected', 400);
    const ip = await rateLimit('request-ip', clientIp(request), LIMITS.requestIp);
    if (!ip.ok) return errorJson('rate_limited', 429, { retryAfter: ip.retryAfter });

    const user = await getCurrentUser();
    const s = (k: string, max: number) => String(body[k] ?? '').trim().slice(0, max);
    const lang = body.lang === 'en' ? 'en' : 'nl';
    const category = REQUEST_CATEGORIES.includes(s('category', 120)) ? s('category', 120) : '';
    const problem = s('description', 2000);
    const extra = s('followUpAnswer', 600);
    const description = (extra ? `${problem}\n\n${extra}` : problem).slice(0, 3000);
    const level = LEVELS.includes(body.level as UrgencyLevel) ? body.level as UrgencyLevel : 'flexible';
    const postcode = s('postcode', 10).toUpperCase().replace(/^(\d{4})\s*([A-Z]{2})$/, '$1 $2');
    const name = s('name', 120) || user?.fullName || '';
    const email = user?.email ?? normalizeEmail(body.email);
    const phone = normalizePhone(s('phone', 40)) || null;
    if (!category || description.length < 10 || !/^\d{4} [A-Z]{2}$/.test(postcode)) return errorJson('invalid_request', 400);
    if (!email) return errorJson('invalid_email', 400);
    if (!name) return errorJson('name_required', 400);
    if (phone && phone.replace(/\D/g, '').length < 9) return errorJson('invalid_phone', 400);
    if (level === 'spoed' && !phone) return errorJson('phone_required', 400);
    if (!user && body.acceptTerms !== true) return errorJson('terms_required', 400);
    if (user && user.role === 'provider') return errorJson('customer_required', 403);
    const perEmail = await rateLimit('request-user', email, LIMITS.requestUser);
    if (!perEmail.ok) return errorJson('rate_limited', 429, { retryAfter: perEmail.retryAfter });
    const photos = (Array.isArray(body.photos) ? body.photos : []).slice(0, 3).map(photo).filter((p): p is { mime: string; data: Buffer } => Boolean(p));
    const summary = s('summary', 240) || problem.slice(0, 200);

    let created;
    try {
      created = await createIntakeRequest(user, {
        category, description, postcode, level, name, email, phone, lang, photos,
        intake: { summary, ai: body.ai === true, provider: s('provider', 20) || null, suggestedCategory: s('suggestedCategory', 120) || null, suggestedLevel: s('suggestedLevel', 20) || null, followUp: s('followUp', 200) || null, photos: photos.length },
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'account_unavailable') return errorJson('account_unavailable', 403);
      throw e;
    }
    const alertsOn = emailAlertsEnabled();
    after(async () => {
      let alerted = created.delivered;
      if (alertsOn) alerted = (await dispatchInitialAlerts(created.id)).alerted;
      else for (const m of created.matched) await sendEmail({ to: m.ownerEmail, kind: m.locked ? 'lead_locked' : 'new_lead', lang: m.ownerLocale, ...newLeadEmail(m.ownerLocale, m.name, category, m.locked) });
      await sendIntakeConfirmation(created.id, alerted);
      await notify('new_request', `${level === 'spoed' ? '🚨 SPOED · ' : ''}${categoryLabel('nl', category)} (${postcode}) via hulp-assistent`, { requestId: created.id, matched: created.matched.length, urgentie: level, klant: name, telefoon: phone ?? '' });
    });
    return json({ id: created.id, statusToken: signToken('status', [created.id], 30), matched: created.delivered, level, alerts: alertsOn }, 201);
  }, 'intake/submit');
}
