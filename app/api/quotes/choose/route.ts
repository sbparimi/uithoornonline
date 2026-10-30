import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { verifyToken } from '@/lib/urgent/tokens';
import { chooseQuote } from '@/lib/urgent/quotes';

export const dynamic = 'force-dynamic';

// The customer picks one quote on the status page (signed status token, no login). The chosen business
// gets the customer's contact details; the others hear the customer chose someone else.
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const limit = await rateLimit('quote-choose', clientIp(request), { limit: 20, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const ids = verifyToken('status', String(body.t ?? ''));
    const quoteId = String(body.quoteId ?? '');
    if (!ids || !/^[0-9a-f-]{36}$/i.test(quoteId)) return errorJson('invalid_token', 404);
    const res = await chooseQuote(ids[0], quoteId);
    if (!res.ok) return errorJson(res.error, res.error === 'taken' ? 409 : 410);
    return json(res);
  }, 'quotes/choose');
}
