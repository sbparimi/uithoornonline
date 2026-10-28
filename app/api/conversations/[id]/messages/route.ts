import { errorJson, handle, json, readJson, sameOrigin, str } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { listMessages, sendMessage } from '@/lib/data/conversations';
import { sendEmail, sentRecently } from '@/lib/email/send';
import { after } from 'next/server';
import { newMessageEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

// Polling endpoint (replaces Supabase realtime): ?since=<ISO timestamp>
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const since = new URL(request.url).searchParams.get('since') || undefined;
    const messages = await listMessages(user, id, since);
    if (!messages) return errorJson('conversation_not_available', 404);
    return json({ messages });
  }, 'messages/list');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const limit = await rateLimit('message-user', user.id, LIMITS.messageUser);
    if (!limit.ok) return errorJson('rate_limited', 429);
    const { id } = await params;
    const body = await readJson(request);
    const message = str(body.body, 4000);
    if (!message) return errorJson('invalid_message', 400);
    const result = await sendMessage(user, id, message);
    if ('error' in result) return errorJson(result.error!, result.error === 'conversation_closed' ? 409 : 403);
    const recipient = result.recipient;
    if (recipient) {
      // Throttled: at most one notification per conversation per recipient per 15 minutes.
      const ref = `msg:${id}:${recipient.email}`;
      after(async () => { if (!(await sentRecently(ref, 15))) await sendEmail({ to: recipient.email, kind: 'new_message', ref, lang: recipient.locale, ...newMessageEmail(recipient.locale, id) }); });
    }
    return json({ id: result.id }, 201);
  }, 'messages/send');
}
