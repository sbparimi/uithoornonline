import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { REQUEST_CATEGORIES } from '@/lib/request-options';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { intakeEnabled, quotesEnabled } from '@/lib/urgent/flags';
import { followUpQuestions } from '@/lib/urgent/ai-request';

export const dynamic = 'force-dynamic';

// AI request flow (docs/AI_REQUESTS.md): after the category and timing, 2-4 short follow-up questions with
// tap-to-answer options, so businesses can quote. AI when configured, a per-category rule set otherwise.
export async function POST(request: Request) {
  return handle(async () => {
    if (!intakeEnabled() || !quotesEnabled()) return errorJson('not_enabled', 404);
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const limit = await rateLimit('intake-questions', clientIp(request), { limit: 40, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const description = String(body.text ?? '').trim().slice(0, 2000);
    const category = String(body.category ?? '');
    if (description.length < 3 || !REQUEST_CATEGORIES.includes(category)) return errorJson('invalid_request', 400);
    const lang = body.lang === 'en' ? 'en' : 'nl';
    const level = ['today', 'week', 'flexible'].includes(String(body.level)) ? String(body.level) : 'flexible';
    const categoryLabel = (getDictionary(lang).requestForm.categories as Record<string, string>)[category] ?? category;
    return json(await followUpQuestions({ description, category, categoryLabel, level, lang }));
  }, 'intake/questions');
}
