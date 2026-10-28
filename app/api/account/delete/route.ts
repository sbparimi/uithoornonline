import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { destroySession, requireUser } from '@/lib/auth/session';
import { deleteAccount } from '@/lib/data/account';
import { notify } from '@/lib/notify';
import { after } from 'next/server';

// Permanent deletion. The user must type their own email address to confirm.
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const body = await readJson(request);
    if (String(body.confirmEmail ?? '').trim().toLowerCase() !== user.email.toLowerCase()) return errorJson('confirmation_mismatch', 400);
    if (user.role === 'admin') return errorJson('admin_cannot_self_delete', 400);
    const summary = await deleteAccount(user);
    await destroySession();
    after(() => notify('account_deleted', `Account verwijderd (${user.role})`, { requests: summary?.requests, businesses: summary?.businesses }));
    return json({ ok: true });
  }, 'account/delete');
}
