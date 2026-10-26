import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { clientIp, LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { looksLikeSpam } from '@/lib/security/spam';
import { cleanRequestInput, createRequest } from '@/lib/data/requests';
import { sendEmail } from '@/lib/email/send';
import { newLeadEmail } from '@/lib/email/templates';
import { notify } from '@/lib/notify';

export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    if (user.role !== 'customer' && user.role !== 'admin') return errorJson('customer_required', 403);
    const body = await readJson(request);
    if (looksLikeSpam(body)) return errorJson('rejected', 400);
    const perUser = await rateLimit('request-user', user.id, LIMITS.requestUser);
    const perIp = await rateLimit('request-ip', clientIp(request), LIMITS.requestIp);
    if (!perUser.ok || !perIp.ok) return errorJson('rate_limited', 429, { retryAfter: Math.max(perUser.retryAfter, perIp.retryAfter) });
    const { value, error } = cleanRequestInput(body);
    if (error) return errorJson(error, 400);
    const result = await createRequest(user, value);
    for (const m of result.matched) {
      void sendEmail({ to: m.ownerEmail, kind: m.locked ? 'lead_locked' : 'new_lead', ...newLeadEmail(m.ownerLocale, m.name, value.category, m.locked) });
    }
    void notify('new_request', `${value.category} (${value.postcode})`, { requestId: result.id, matched: result.matched.length, delivered: result.delivered, overLimit: result.matched.filter((m) => m.locked).map((m) => m.name).join(', ') });
    return json({ id: result.id, matched: result.delivered, status: result.delivered ? 'matched' : 'open' }, 201);
  }, 'requests');
}
