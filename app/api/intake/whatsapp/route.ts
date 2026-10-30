import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { trackEvent } from '@/lib/data/misc';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { whatsappContactNumber } from '@/lib/urgent/flags';

export const dynamic = 'force-dynamic';

// Counts clicks on the help assistant's WhatsApp fallback ("Lukt het niet? Stuur ons een WhatsApp").
// Anonymous: only why it was shown (e.g. submit_network, ai_failed, link_problem) and the language.
// Shown in Admin → Spoed.
export async function POST(request: Request) {
  return handle(async () => {
    if (!whatsappContactNumber()) return errorJson('not_enabled', 404);
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const limit = await rateLimit('intake-whatsapp', clientIp(request), { limit: 30, windowSeconds: 3600 });
    if (!limit.ok) return json({ ok: true });
    const body = await readJson(request);
    const reason = String(body.reason ?? '').toLowerCase().replace(/[^a-z0-9_:-]/g, '').slice(0, 40) || 'unknown';
    const lang = body.lang === 'en' ? 'en' : 'nl';
    await trackEvent('intake_whatsapp_fallback', null, null, { reason, lang });
    return json({ ok: true });
  }, 'intake/whatsapp');
}
