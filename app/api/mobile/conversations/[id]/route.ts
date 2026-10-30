import { errorJson, handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { getConversation } from '@/lib/data/conversations';

export const dynamic = 'force-dynamic';

// One conversation with its request details and messages (participants only).
// New messages: GET/POST /api/conversations/[id]/messages (shared with the website).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const conversation = await getConversation(user, id);
    if (!conversation) return errorJson('conversation_not_available', 404);
    return json({ conversation });
  }, 'mobile/conversation');
}
