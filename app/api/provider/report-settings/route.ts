import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { saveOwnExtras } from '@/lib/ai-business/profile';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const body = await readJson(request);
    if (typeof body.report_email !== 'boolean') return errorJson('invalid', 400);
    const ok = await saveOwnExtras(user, { report_email: body.report_email });
    return ok ? json({ ok: true, report_email: body.report_email }) : errorJson('provider_required', 403);
  }, 'provider/report-settings');
}
