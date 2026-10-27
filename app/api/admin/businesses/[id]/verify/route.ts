import { errorJson, handle, json, sameOrigin } from '@/lib/http';
import { requireRole } from '@/lib/auth/session';
import { adminModerateBusiness, adminSetBusinessFlags } from '@/lib/data/admin';

// Kept for the existing "verify" button: approve + mark verified in one step.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const admin = await requireRole('admin');
    const { id } = await params;
    const row = await adminModerateBusiness(admin, id, 'approved', null);
    if (!row) return errorJson('not_found', 404);
    await adminSetBusinessFlags(admin, id, { verified: true, active: true });
    return json({ ok: true });
  }, 'admin/verify');
}
