import { handle, errorJson } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { exportUserData } from '@/lib/data/account';
import { LIMITS, rateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const limit = await rateLimit('account-action', user.id, LIMITS.accountAction);
    if (!limit.ok) return errorJson('rate_limited', 429);
    const data = await exportUserData(user);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="uithoorn-online-mijn-gegevens-${date}.json"`, 'Cache-Control': 'no-store' },
    });
  }, 'account/export');
}
