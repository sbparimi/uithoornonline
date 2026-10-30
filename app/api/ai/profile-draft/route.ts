import { errorJson, handle, json, readJson, sameOrigin, str } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { getCurrentUser } from '@/lib/auth/session';
import { buildProfileDraft } from '@/lib/ai-business/profile-draft';
import { SiteFetchError } from '@/lib/ai-business/fetch-site';
import { trackEvent } from '@/lib/data/misc';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// "Maak mijn profiel met AI": reads the business's own website (and/or what the owner typed) and returns
// an editable draft. Nothing is saved here; the owner reviews and saves on the profile page or signup form.
// Signed-in owners: 12 drafts/hour. Not signed in (signup form): 4 per IP per hour.
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await getCurrentUser();
    const limit = user
      ? await rateLimit('ai-draft-user', user.id, { limit: 12, windowSeconds: 3600 })
      : await rateLimit('ai-draft-ip', clientIp(request), { limit: 4, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429, { retryAfter: limit.retryAfter });
    const body = await readJson(request);
    const website = str(body.website, 300);
    const about = str(body.about, 1500);
    const name = str(body.name, 120);
    const kvk = str(body.kvk, 20).replace(/\s/g, '');
    if (kvk && !/^\d{8}$/.test(kvk)) return errorJson('invalid_kvk', 400);
    if (!website && about.length < 20) return errorJson('need_website_or_about', 400);
    try {
      const draft = await buildProfileDraft({ website, about, name, kvk, lang: body.lang === 'en' ? 'en' : 'nl' });
      await trackEvent('ai_profile_generated', null, null, { ai: draft.ai.used, site: !!draft.source.website, signedIn: !!user }).catch(() => undefined);
      return json({ draft: user ? draft : { ...draft, photos: [] } });
    } catch (e) {
      if (e instanceof SiteFetchError) return errorJson('site_unreadable', 422, { reason: e.code });
      throw e;
    }
  }, 'ai/profile-draft');
}
