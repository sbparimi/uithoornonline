import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { intakeEnabled } from '@/lib/urgent/flags';
import { classifyIntake } from '@/lib/urgent/llm';

export const dynamic = 'force-dynamic';

// Step 1 of the "Hulp nodig?" intake: what is wrong → category, urgency, a one-line summary and,
// for spoed, a safety tip. LLM when configured, rules otherwise (lib/urgent/llm.ts).
export async function POST(request: Request) {
  return handle(async () => {
    if (!intakeEnabled()) return errorJson('not_enabled', 404);
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const limit = await rateLimit('intake-classify', clientIp(request), { limit: 40, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const text = String(body.text ?? '').trim().slice(0, 2000);
    if (text.length < 3) return errorJson('too_short', 400);
    const lang = body.lang === 'en' ? 'en' : 'nl';
    return json(await classifyIntake(text, lang));
  }, 'intake/classify');
}
