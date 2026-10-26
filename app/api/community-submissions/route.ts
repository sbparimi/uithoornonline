import { errorJson, handle, json, readJson, sameOrigin, str } from '@/lib/http';
import { clientIp, LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { looksLikeSpam } from '@/lib/security/spam';
import { normalizeEmail } from '@/lib/data/users';
import { createCommunitySubmission } from '@/lib/data/misc';
import { notify } from '@/lib/notify';

const kinds = new Set(['business', 'tip', 'event']);

export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const body = await readJson(request);
    if (looksLikeSpam(body)) return errorJson('rejected', 400);
    const limit = await rateLimit('submission-ip', clientIp(request), LIMITS.submissionIp);
    if (!limit.ok) return errorJson('rate_limited', 429, { retryAfter: limit.retryAfter });
    const kind = str(body.kind, 20); const name = str(body.name, 120); const email = normalizeEmail(body.email);
    const title = str(body.title, 180); const description = str(body.description, 3000);
    if (!kinds.has(kind) || name.length < 2 || !email || title.length < 3 || description.length < 15) return errorJson('invalid_submission', 400);
    const row = await createCommunitySubmission({ kind, name, email, phone: str(body.phone, 40) || null, title, description, category: str(body.category, 120) || null, postcode: str(body.postcode, 20).toUpperCase() || null, website: str(body.website, 500) || null });
    void notify('new_submission', `${kind}: ${title}`, { name, email });
    return json({ id: row?.id, status: 'pending' }, 201);
  }, 'community-submissions');
}
