import { errorJson, handle, json, readJson, sameOrigin, str } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { updateOwnProfile } from '@/lib/data/users';

// Users can change their name, phone and language. `role` (and anything else) is ignored:
// the old Supabase policy let users write their own role and become admin.
export async function PATCH(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const body = await readJson(request);
    const input: { fullName?: string; phone?: string | null; locale?: 'nl' | 'en' } = {};
    if (body.fullName !== undefined) { const v = str(body.fullName, 120); if (v.length < 2) return errorJson('invalid_name', 400); input.fullName = v; }
    if (body.phone !== undefined) input.phone = str(body.phone, 40) || null;
    if (body.locale !== undefined) input.locale = body.locale === 'en' ? 'en' : 'nl';
    await updateOwnProfile(user, input);
    return json({ ok: true, ignored: Object.keys(body).filter((k) => !['fullName', 'phone', 'locale'].includes(k)) });
  }, 'account/profile');
}
