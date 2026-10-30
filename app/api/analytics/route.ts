import { errorJson, handle, json, readJson } from '@/lib/http';
import { clientIp, LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { ANALYTICS_EVENTS, trackEvent } from '@/lib/data/misc';

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    const name = String(body.eventName ?? '').trim();
    if (!ANALYTICS_EVENTS.has(name)) return errorJson('invalid_event', 400);
    // Crawlers and link previews are not people: don't count them in a business's numbers.
    if (/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse/i.test(request.headers.get('user-agent') || '')) return json({ ok: true, dropped: true });
    const limit = await rateLimit('analytics-ip', clientIp(request), LIMITS.analyticsIp);
    if (!limit.ok) return json({ ok: true, dropped: true });
    const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {};
    await trackEvent(name, body.businessId ? String(body.businessId) : null, body.requestId ? String(body.requestId) : null, metadata);
    return json({ ok: true });
  }, 'analytics');
}
