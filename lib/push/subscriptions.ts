import 'server-only';
import { query, queryOne } from '../db';
import { pushConfigured, sendPush, type PushMessage } from './webpush';

// Business owners' push subscriptions (migration 0006). Every helper tolerates a database without
// the table (returns nothing), so the site keeps working before the migration is applied.

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

const missingTable = (e: unknown) => (e as { code?: string })?.code === '42P01';

export async function saveSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string | null) {
  const business = await queryOne<{ id: string }>('select id from businesses where owner_id = $1 order by created_at limit 1', [userId]);
  await query(
    `insert into push_subscriptions(user_id, business_id, endpoint, p256dh, auth, user_agent) values ($1,$2,$3,$4,$5,$6)
     on conflict (endpoint) do update set user_id = excluded.user_id, business_id = excluded.business_id, p256dh = excluded.p256dh, auth = excluded.auth,
       user_agent = excluded.user_agent, failures = 0, last_error = null`,
    [userId, business?.id ?? null, sub.endpoint, sub.p256dh, sub.auth, userAgent?.slice(0, 300) ?? null]);
  return { businessId: business?.id ?? null };
}

export async function deleteSubscription(userId: string, endpoint: string) {
  await query('delete from push_subscriptions where user_id = $1 and endpoint = $2', [userId, endpoint]);
}

export async function countSubscriptions(userId: string) {
  try { return (await queryOne<{ n: number }>('select count(*)::int as n from push_subscriptions where user_id = $1', [userId]))?.n ?? 0; }
  catch (e) { if (missingTable(e)) return 0; throw e; }
}

async function deliver(rows: SubRow[], msg: PushMessage) {
  let sent = 0; let last: string | null = null;
  for (const s of rows) {
    const res = await sendPush(s, msg);
    if (res.ok) {
      sent++;
      await query('update push_subscriptions set last_success_at = now(), failures = 0, last_error = null where id = $1', [s.id]).catch(() => undefined);
    } else if (res.gone) {
      await query('delete from push_subscriptions where id = $1', [s.id]).catch(() => undefined);
      last = res.error;
    } else {
      await query('update push_subscriptions set failures = failures + 1, last_error = $2 where id = $1', [s.id, res.error?.slice(0, 500) ?? null]).catch(() => undefined);
      last = res.error;
    }
  }
  return { devices: rows.length, sent, error: sent ? null : last };
}

/** Push to every device of a business's owner. Never throws. */
export async function pushToBusiness(businessId: string, msg: PushMessage) {
  if (!pushConfigured()) return { devices: 0, sent: 0, error: 'push_not_configured' };
  try {
    const rows = await query<SubRow>(
      `select s.id, s.endpoint, s.p256dh, s.auth from push_subscriptions s
         where s.business_id = $1 or s.user_id = (select owner_id from businesses where id = $1)`, [businessId]);
    return await deliver(rows, msg);
  } catch (e) {
    if (!missingTable(e)) console.error('[push] business push failed', e instanceof Error ? e.message : e);
    return { devices: 0, sent: 0, error: 'push_failed' };
  }
}

/** Push to one user's own devices (the "send a test notification" button). */
export async function pushToUser(userId: string, msg: PushMessage) {
  const rows = await query<SubRow>('select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1', [userId]);
  return deliver(rows, msg);
}
