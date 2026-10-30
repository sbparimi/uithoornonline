import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { verifyToken } from '@/lib/urgent/tokens';
import { acceptJob } from '@/lib/urgent/alerts';

export const dynamic = 'force-dynamic';

// One-tap accept from an alert (email/SMS/WhatsApp link → /klus/<token> → this POST). No login:
// the signed token names the request and the business. GET never accepts (mail scanners prefetch links).
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const limit = await rateLimit('alert-accept', clientIp(request), { limit: 30, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const ids = verifyToken('accept', String(body.t ?? ''));
    if (!ids) return errorJson('invalid_token', 404);
    const result = await acceptJob(ids[0], ids[1], 'link');
    if (!result.ok) return errorJson(result.error, result.error === 'taken' ? 409 : 410);
    return json(result);
  }, 'alerts/accept');
}
