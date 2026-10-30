import { after } from 'next/server';
import { LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { notify } from '@/lib/notify';
import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { cleanBusinessInput, getOwnBusiness, updateOwnBusiness } from '@/lib/data/businesses';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const business = await getOwnBusiness(user);
    if (!business) return errorJson('provider_required', 403);
    return json({ business });
  }, 'provider/profile/get');
}

// Owners edit their listing details only. verified / featured / moderation_status / active in the
// body are ignored (and reported back in `ignored`).
export async function PATCH(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const limit = await rateLimit('account-action', user.id, LIMITS.accountAction);
    if (!limit.ok) return errorJson('rate_limited', 429);
    const body = await readJson(request);
    const { value, error } = cleanBusinessInput(body);
    if (error) return errorJson(error, 400);
    const before = await getOwnBusiness(user);
    const business = await updateOwnBusiness(user, value);
    if (!business) return errorJson('provider_required', 403);
    // Public contact details change without review, so the admin hears about every change to them.
    const watched = ['name', 'phone', 'website', 'address', 'public_email'] as const;
    const changed = before ? watched.filter((k) => (before[k] ?? '') !== (business[k] ?? '')) : [];
    if (changed.length) after(() => notify('business_updated', business.name, Object.fromEntries(changed.map((k) => [k, `${before?.[k] ?? '—'} → ${business[k] ?? '—'}`]))));
    const allowed = ['name', 'category', 'description', 'postcode', 'address', 'website', 'phone', 'public_email'];
    return json({ business, ignored: Object.keys(body).filter((k) => !allowed.includes(k)) });
  }, 'provider/profile/update');
}
