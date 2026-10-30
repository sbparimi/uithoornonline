import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { looksLikeSpam } from '@/lib/security/spam';
import { verifyToken } from '@/lib/urgent/tokens';
import { createJobReview } from '@/lib/urgent/quotes';

export const dynamic = 'force-dynamic';

// Verified review from the link in the review request (/beoordeling/<token>): only for a completed job,
// from that job's customer, once. Shown on the business page with the "Geverifieerde klus" label.
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const limit = await rateLimit('review-verified', clientIp(request), { limit: 10, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    if (looksLikeSpam(body)) return errorJson('rejected', 400);
    const ids = verifyToken('review', String(body.t ?? ''));
    if (!ids) return errorJson('invalid_token', 404);
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return errorJson('invalid_rating', 400);
    const text = String(body.body ?? '').replace(/\r/g, '').trim().slice(0, 1000);
    const res = await createJobReview(ids[0], rating, text);
    if (!res.ok) return errorJson(res.error, res.error === 'already_reviewed' ? 409 : 403);
    return json(res, 201);
  }, 'reviews/verified');
}
