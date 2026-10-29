import { errorJson, handle, json, sameOrigin } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { acceptRequest } from '@/lib/data/conversations';
import { sendEmail } from '@/lib/email/send';
import { requestAcceptedEmail } from '@/lib/email/templates';
import { after } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const { id } = await params;
    const result = await acceptRequest(user, id);
    if ('error' in result) return errorJson(result.error!, result.error === 'lead_limit_reached' ? 402 : 403);
    after(() => sendEmail({ to: result.customerEmail, kind: 'request_accepted', lang: result.customerLocale, ...requestAcceptedEmail(result.customerLocale, result.businessName, result.conversationId) }));
    return json({ conversationId: result.conversationId });
  }, 'provider/accept');
}
