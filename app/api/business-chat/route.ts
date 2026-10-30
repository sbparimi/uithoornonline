import { errorJson, handle, json, readJson } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { answerChat, getChatBusiness, type ChatTurn } from '@/lib/ai-business/chat';
import { trackEvent } from '@/lib/data/misc';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// AI assistant on a business page. Stateless: the browser sends the last few turns. Abuse limits:
// 20 messages per IP per 10 min, 8 turns kept, 400 characters per message.
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    const lang = body.lang === 'en' ? 'en' : 'nl';
    const b = await getChatBusiness(String(body.businessId ?? ''));
    if (!b) return errorJson('not_found', 404);
    const ip = clientIp(request);
    const limit = await rateLimit('biz-chat-ip', ip, { limit: 20, windowSeconds: 600 });
    if (!limit.ok) return errorJson('rate_limited', 429, { retryAfter: limit.retryAfter });
    const turns: ChatTurn[] = (Array.isArray(body.messages) ? body.messages : []).slice(-8)
      .map((m: { role?: unknown; content?: unknown }) => ({ role: m?.role === 'assistant' ? 'assistant' as const : 'user' as const, content: String(m?.content ?? '').trim().slice(0, 400) }))
      .filter((m: ChatTurn) => m.content);
    if (!turns.length || turns[turns.length - 1].role !== 'user') return errorJson('invalid_message', 400);
    const answer = await answerChat(b, turns, lang);
    if (turns.filter((t) => t.role === 'user').length === 1) await trackEvent('chat_open', b.id, null, { lang, source: answer.source }).catch(() => undefined);
    return json(answer);
  }, 'business-chat');
}
