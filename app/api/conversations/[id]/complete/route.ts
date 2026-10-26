import { errorJson, handle, json, sameOrigin } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { completeConversation } from '@/lib/data/conversations';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const { id } = await params;
    const ok = await completeConversation(user, id);
    if (!ok) return errorJson('conversation_not_available', 403);
    return json({ status: 'completed' });
  }, 'conversations/complete');
}
