import { after } from 'next/server';
import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { rateLimit } from '@/lib/security/rate-limit';
import { requireUser } from '@/lib/auth/session';
import { cleanBusinessInput, getOwnBusiness, updateOwnBusiness } from '@/lib/data/businesses';
import { addOwnPhotos, cleanExtras, getOwnExtras, removeOwnPhoto, saveOwnExtras } from '@/lib/ai-business/profile';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const business = await getOwnBusiness(user);
    if (!business) return errorJson('provider_required', 403);
    return json({ business, extras: await getOwnExtras(user) });
  }, 'provider/ai-profile/get');
}

// One save for the whole profile: the existing listing fields (same allow-list and validation as
// /api/provider/profile) plus the 0006 extras. verified / featured / moderation fields are never accepted.
export async function PATCH(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const limit = await rateLimit('profile-save', user.id, { limit: 30, windowSeconds: 3600 });
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const base = (body.business && typeof body.business === 'object' ? body.business : {}) as Record<string, unknown>;
    const { value, error } = cleanBusinessInput(base);
    if (error) return errorJson(error, 400);
    if (value.description !== undefined && value.description.length < 20) return errorJson('description_too_short', 400);
    const extras = cleanExtras((body.extras && typeof body.extras === 'object' ? body.extras : {}) as Record<string, unknown>);
    if (extras.error) return errorJson(extras.error, 400);
    const before = await getOwnBusiness(user);
    if (!before) return errorJson('provider_required', 403);
    const business = await updateOwnBusiness(user, value);
    if (!business) return errorJson('provider_required', 403);
    const saved = await saveOwnExtras(user, extras.value);
    if (!saved) return errorJson('not_migrated', 503);
    let photosAdded = 0;
    if (body.photo_consent === true && Array.isArray(body.add_photos)) photosAdded = await addOwnPhotos(user, (body.add_photos as { url?: unknown; alt?: unknown }[]).slice(0, 8).map((p) => ({ url: String(p?.url ?? ''), alt: String(p?.alt ?? '') })));
    if (Array.isArray(body.remove_photos)) for (const id of body.remove_photos.slice(0, 12)) if (/^[0-9a-f-]{36}$/i.test(String(id))) await removeOwnPhoto(user, String(id));
    const watched = ['name', 'phone', 'website', 'address', 'public_email'] as const;
    const changed = watched.filter((k) => (before[k] ?? '') !== (business[k] ?? ''));
    if (changed.length || photosAdded) after(() => notify('business_updated', business.name, { ...Object.fromEntries(changed.map((k) => [k, `${before[k] ?? '—'} → ${business[k] ?? '—'}`])), ...(photosAdded ? { photos_added_from_own_site: photosAdded } : {}), ...(extras.value.ai_profile ? { ai_profile: 'AI draft reviewed + saved by owner' } : {}) }));
    return json({ business, extras: await getOwnExtras(user), photosAdded });
  }, 'provider/ai-profile/update');
}
