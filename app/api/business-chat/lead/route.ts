import { errorJson, handle, json, readJson, str } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { looksLikeSpam } from '@/lib/security/spam';
import { normalizePhone } from '@/lib/phone';
import { createChatLead, getChatBusiness, type ChatTurn } from '@/lib/ai-business/chat';
import { trackEvent } from '@/lib/data/misc';

export const dynamic = 'force-dynamic';

// A visitor leaves name + ONE contact detail + question; the business gets an email (admin BCC via
// lib/email/send.ts) and sees it under "Jouw leads". 4 per IP per hour.
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    if (looksLikeSpam(body)) return json({ ok: true }); // silently drop bots
    const b = await getChatBusiness(String(body.businessId ?? ''));
    if (!b) return errorJson('not_found', 404);
    const limit = await rateLimit('biz-lead-ip', clientIp(request), { limit: 4, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429, { retryAfter: limit.retryAfter });
    const name = str(body.name, 120);
    const email = str(body.email, 254).toLowerCase() || null;
    const phone = normalizePhone(str(body.phone, 40)).slice(0, 40) || null;
    const question = str(body.question, 2000);
    if (name.length < 2) return errorJson('invalid_name', 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return errorJson('invalid_email', 400);
    if (phone && phone.replace(/\D/g, '').length < 9) return errorJson('invalid_phone', 400);
    if (!email && !phone) return errorJson('contact_required', 400);
    if (question.length < 3) return errorJson('invalid_question', 400);
    if (body.consent !== true) return errorJson('consent_required', 400);
    const transcript: ChatTurn[] = (Array.isArray(body.messages) ? body.messages : []).slice(-10)
      .map((m: { role?: unknown; content?: unknown }) => ({ role: m?.role === 'assistant' ? 'assistant' as const : 'user' as const, content: String(m?.content ?? '').trim().slice(0, 600) })).filter((m: ChatTurn) => m.content);
    const lead = await createChatLead(b, { name, email, phone, question, transcript, lang: body.lang === 'en' ? 'en' : 'nl' });
    await trackEvent('chat_lead', b.id, null, {}).catch(() => undefined);
    return json({ ok: true, delivered: lead.emailStatus === 'sent' || lead.emailStatus === 'skipped' });
  }, 'business-chat/lead');
}
