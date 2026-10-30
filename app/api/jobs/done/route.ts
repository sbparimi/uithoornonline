import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { verifyToken } from '@/lib/urgent/tokens';
import { markJobDone } from '@/lib/urgent/quotes';

export const dynamic = 'force-dynamic';

// "Klus is klaar": the customer (status token) or the chosen business (its job token) marks the job done.
// The customer then gets one review request (verified: tied to this real job).
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const limit = await rateLimit('job-done', clientIp(request), { limit: 20, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const t = String(body.t ?? '');
    const customer = verifyToken('status', t);
    const business = customer ? null : verifyToken('accept', t);
    if (!customer && !business) return errorJson('invalid_token', 404);
    const res = customer ? await markJobDone(customer[0], 'customer') : await markJobDone(business![0], 'business', business![1]);
    return res.ok ? json(res) : errorJson(res.error, 409);
  }, 'jobs/done');
}
