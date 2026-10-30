import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { verifyToken } from '@/lib/urgent/tokens';
import { queryOne } from '@/lib/db';
import { acceptRequest } from '@/lib/data/conversations';
import type { SessionUser } from '@/lib/auth/session';
import { sendEmail } from '@/lib/email/send';
import { requestAcceptedEmail } from '@/lib/email/templates';
import { after } from 'next/server';

export const dynamic = 'force-dynamic';

// One-tap "I'll respond" from a lead alert (email/push → /aanvraag/<token> → this POST). No login: the
// signed token names the request and the business; the accept is the same as the dashboard's
// (lib/data/conversations.ts acceptRequest, done for the business owner). GET never accepts.
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const limit = await rateLimit('lead-accept', clientIp(request), { limit: 30, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const ids = verifyToken('lead', String(body.t ?? ''));
    if (!ids) return errorJson('invalid_token', 404);
    const owner = await queryOne<{ owner_id: string }>(`select owner_id from businesses where id = $1 and active and moderation_status = 'approved'`, [ids[1]]);
    if (!owner) return errorJson('business_unavailable', 410);
    const result = await acceptRequest({ id: owner.owner_id } as SessionUser, ids[0]);
    if ('error' in result) return errorJson(result.error!, result.error === 'lead_limit_reached' ? 402 : 410);
    after(() => sendEmail({ to: result.customerEmail, kind: 'request_accepted', lang: result.customerLocale, ...requestAcceptedEmail(result.customerLocale, result.businessName, result.conversationId) }));
    return json({ conversationId: result.conversationId, businessName: result.businessName });
  }, 'leads/accept');
}
