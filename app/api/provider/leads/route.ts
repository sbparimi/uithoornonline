import { errorJson, handle, json, readJson, sameOrigin, str } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { listLeadsForOwner, updateLeadStatus } from '@/lib/data/leads';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const data = await listLeadsForOwner(user);
    if (!data) return errorJson('provider_required', 403);
    return json(data);
  }, 'provider/leads/list');
}

export async function PATCH(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const body = await readJson(request);
    const result = await updateLeadStatus(user, str(body.leadId, 40), str(body.status, 20));
    if (result === 'invalid_request') return errorJson(result, 400);
    if (result === 'not_authorized') return errorJson(result, 403);
    return json({ ok: true });
  }, 'provider/leads/update');
}
