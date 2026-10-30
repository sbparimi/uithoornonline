import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { rateLimit } from '@/lib/security/rate-limit';
import { pushToUser } from '@/lib/push/subscriptions';
import { pushConfigured } from '@/lib/push/webpush';
import { lp } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

/** "Stuur een testmelding": a push to the signed-in user's own devices. */
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    if (!pushConfigured()) return errorJson('not_enabled', 404);
    const user = await requireUser();
    const limit = await rateLimit('push-test', user.id, { limit: 10, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const en = body.lang === 'en';
    const res = await pushToUser(user.id, {
      title: en ? 'Notifications are on ✅' : 'Meldingen staan aan ✅',
      body: en ? 'This is how a new request from Uithoorn.online will reach you.' : 'Zo krijg je straks een nieuwe aanvraag van Uithoorn.online binnen.',
      url: lp(en ? 'en' : 'nl', '/provider'), tag: 'test',
    });
    return json(res);
  }, 'push/test');
}
