import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { verifyToken } from '@/lib/urgent/tokens';
import { declineQuote, submitQuote, type QuoteInput } from '@/lib/urgent/quotes';

export const dynamic = 'force-dynamic';

// A business answers a quote request from its one-tap job page (/klus/<token>, no login: the signed
// token names the request and the business). action "quote" sends or updates the quote; "decline" passes.
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const limit = await rateLimit('quote-submit', clientIp(request), { limit: 30, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const ids = verifyToken('accept', String(body.t ?? ''));
    if (!ids) return errorJson('invalid_token', 404);
    if (body.action === 'decline') {
      const res = await declineQuote(ids[0], ids[1]);
      return res.ok ? json(res) : errorJson(res.error, 404);
    }
    const priceType = (['fixed', 'from', 'hourly', 'visit'] as const).find((p) => p === body.priceType) ?? 'fixed';
    const euros = Number(String(body.amount ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    const amountCents = priceType === 'visit' ? null : Number.isFinite(euros) && euros > 0 && euros <= 1_000_000 ? Math.round(euros * 100) : NaN;
    if (Number.isNaN(amountCents)) return errorJson('invalid_amount', 400);
    const message = String(body.message ?? '').replace(/\r/g, '').trim().slice(0, 1000);
    const date = String(body.availableFrom ?? '');
    const availableFrom = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? date : null;
    const q: QuoteInput = { amountCents, priceType, message, availableFrom };
    const res = await submitQuote(ids[0], ids[1], q);
    if (!res.ok) return errorJson(res.error, res.error === 'closed' ? 409 : 404);
    return json(res);
  }, 'quotes');
}
