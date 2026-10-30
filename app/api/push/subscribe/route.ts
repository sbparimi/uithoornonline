import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { deleteSubscription, saveSubscription } from '@/lib/push/subscriptions';
import { isAllowedEndpoint, pushConfigured } from '@/lib/push/webpush';

export const dynamic = 'force-dynamic';

function parse(body: Record<string, unknown>) {
  const sub = (body.subscription ?? body) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof sub.endpoint === 'string' ? sub.endpoint.trim() : '';
  const p256dh = typeof sub.keys?.p256dh === 'string' ? sub.keys.p256dh.trim() : '';
  const auth = typeof sub.keys?.auth === 'string' ? sub.keys.auth.trim() : '';
  return { endpoint, p256dh, auth };
}

/** A business owner switches push notifications on for this browser/device. */
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    if (!pushConfigured()) return errorJson('not_enabled', 404);
    const user = await requireUser();
    const limit = await rateLimit('push-subscribe', clientIp(request), { limit: 20, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const s = parse(await readJson(request));
    if (!isAllowedEndpoint(s.endpoint) || s.endpoint.length > 1000 || !/^[A-Za-z0-9_-]{80,100}={0,2}$/.test(s.p256dh) || !/^[A-Za-z0-9_-]{16,40}={0,2}$/.test(s.auth)) return errorJson('invalid_subscription', 400);
    const saved = await saveSubscription(user.id, s, request.headers.get('user-agent'));
    return json({ ok: true, business: Boolean(saved.businessId) });
  }, 'push/subscribe');
}

export async function DELETE(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const s = parse(await readJson(request));
    if (s.endpoint) await deleteSubscription(user.id, s.endpoint);
    return json({ ok: true });
  }, 'push/unsubscribe');
}
