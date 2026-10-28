import { errorJson, handle, json, readJson, sameOrigin, str } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { createReview } from '@/lib/data/reviews';
import { notify } from '@/lib/notify';
import { after } from 'next/server';

export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const limit = await rateLimit('review-user', user.id, LIMITS.reviewUser);
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const rating = Number(body.rating);
    const text = str(body.body, 1000);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return errorJson('invalid_review', 400);
    const result = await createReview(user, str(body.conversationId, 40), rating, text);
    if ('error' in result) return errorJson(result.error!, result.error === 'already_reviewed' ? 409 : 403);
    after(() => notify('new_review', `${rating}/5 voor ${result.businessName}`, { reviewId: result.id, text }));
    return json({ id: result.id }, 201);
  }, 'reviews');
}
