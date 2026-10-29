import 'server-only';
import { query, queryOne, transaction } from '../db';
import type { Role, SessionUser } from '../auth/session';

// Every function here must be called with a user that requireRole('admin') returned.
// They are the ONLY code paths that write role, verified, featured, moderation_status, plans.

async function audit(actor: SessionUser, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  await query('insert into audit_log(actor_id, action, target_type, target_id, details) values ($1,$2,$3,$4,$5)', [actor.id, action, targetType, targetId, JSON.stringify(details)]);
}
function assertAdmin(user: SessionUser) { if (user.role !== 'admin') throw new Error('admin_required'); }
const isId = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function adminStats(user: SessionUser) {
  assertAdmin(user);
  return queryOne<Record<string, number>>(`select
    (select count(*)::int from users) as users,
    (select count(*)::int from users where created_at > now() - interval '30 days') as users_30d,
    (select count(*)::int from businesses where moderation_status = 'pending') as businesses_pending,
    (select count(*)::int from businesses where moderation_status = 'approved' and active) as businesses_live,
    (select count(*)::int from service_requests where created_at > now() - interval '30 days') as requests_30d,
    (select count(*)::int from leads where created_at > now() - interval '30 days') as leads_30d,
    (select count(*)::int from leads where status = 'locked' and created_at > now() - interval '30 days') as leads_locked_30d,
    (select count(*)::int from business_subscriptions where plan_key <> 'free' and status = 'active') as paying_businesses,
    (select count(*)::int from contact_messages where status = 'new') as contact_new,
    (select count(*)::int from email_outbox where status = 'skipped' and created_at > now() - interval '30 days') as emails_skipped_30d`);
}

export async function adminListBusinesses(user: SessionUser) {
  assertAdmin(user);
  return query<{ id: string; name: string; category: string; postcode: string | null; phone: string | null; website: string | null; moderation_status: string; verified: boolean; featured: boolean; active: boolean; created_at: string; owner_email: string | null; plan_key: string; leads_month: number }>(
    `select b.id, b.name, b.category, b.postcode, b.phone, b.website, b.moderation_status, b.verified, b.featured, b.active, b.created_at,
            u.email as owner_email, coalesce(s.plan_key, 'free') as plan_key,
            (select count(*)::int from leads l where l.business_id = b.id and l.created_at >= date_trunc('month', now())) as leads_month
       from businesses b left join users u on u.id = b.owner_id left join business_subscriptions s on s.business_id = b.id
      order by case b.moderation_status when 'pending' then 0 when 'approved' then 1 else 2 end, b.created_at desc limit 500`);
}

export async function adminModerateBusiness(user: SessionUser, businessId: string, decision: 'approved' | 'rejected' | 'pending', note: string | null) {
  assertAdmin(user);
  if (!isId(businessId) || !['approved', 'rejected', 'pending'].includes(decision)) return null;
  const row = await queryOne<{ id: string; name: string; owner_email: string | null; owner_locale: 'nl' | 'en' | null }>(
    `update businesses b set moderation_status = $2, moderation_note = $3 from (select id from businesses where id = $1) x
      where b.id = x.id returning b.id, b.name, (select email from users where id = b.owner_id) as owner_email, (select locale from users where id = b.owner_id) as owner_locale`,
    [businessId, decision, note]);
  if (row) await audit(user, `business_${decision}`, 'business', businessId, { note });
  return row;
}

export async function adminSetBusinessFlags(user: SessionUser, businessId: string, flags: { verified?: boolean; featured?: boolean; active?: boolean }) {
  assertAdmin(user);
  if (!isId(businessId)) return false;
  const sets: string[] = []; const params: unknown[] = [businessId];
  for (const key of ['verified', 'featured', 'active'] as const) {
    if (typeof flags[key] === 'boolean') { params.push(flags[key]); sets.push(`${key} = $${params.length}`); }
  }
  if (!sets.length) return false;
  const row = await queryOne(`update businesses set ${sets.join(', ')} where id = $1 returning id`, params);
  if (row) await audit(user, 'business_flags', 'business', businessId, flags);
  return Boolean(row);
}

export async function adminSetBusinessOwner(user: SessionUser, businessId: string, ownerEmail: string | null) {
  assertAdmin(user);
  if (!isId(businessId)) return 'invalid_request';
  let ownerId: string | null = null;
  if (ownerEmail) {
    const owner = await queryOne<{ id: string }>('select id from users where email = $1', [ownerEmail.toLowerCase()]);
    if (!owner) return 'user_not_found';
    ownerId = owner.id;
    await query(`update users set role = 'provider' where id = $1 and role = 'customer'`, [ownerId]);
  }
  const row = await queryOne('update businesses set owner_id = $2 where id = $1 returning id', [businessId, ownerId]);
  if (row) await audit(user, 'business_owner', 'business', businessId, { ownerEmail });
  return row ? 'ok' : 'not_found';
}

/** Manual plan activation (payment received outside the site). Unlocks this month's locked leads up to the new allowance. */
export async function adminSetBusinessPlan(user: SessionUser, businessId: string, planKey: 'free' | 'pro' | 'pro_plus', note: string | null) {
  assertAdmin(user);
  if (!isId(businessId) || !['free', 'pro', 'pro_plus'].includes(planKey)) return null;
  const result = await transaction(async (client) => {
    const { rowCount } = await client.query('select 1 from businesses where id = $1', [businessId]);
    if (!rowCount) return null;
    await client.query(
      `insert into business_subscriptions(business_id, plan_key, status, payment_provider, note, current_period_end)
       values ($1, $2, 'active', 'manual', $3, case when $2 = 'free' then null else now() + interval '1 month' end)
       on conflict (business_id) do update set plan_key = excluded.plan_key, status = 'active', payment_provider = 'manual', note = excluded.note, current_period_end = excluded.current_period_end`,
      [businessId, planKey, note]);
    const monthStart = "(date_trunc('month', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam')";
    const { rows: [u] } = await client.query<{ included: number; used: number }>(
      `select p.included_leads as included, (select count(*)::int from leads where business_id = $1 and counts_toward_limit and status <> 'locked' and created_at >= ${monthStart}) as used
         from business_plans p where p.key = $2`, [businessId, planKey]);
    const room = Math.max(0, u.included - u.used);
    let unlocked = 0;
    if (room > 0) {
      const { rowCount: n } = await client.query(
        `update leads set status = 'new' where id in (select id from leads where business_id = $1 and status = 'locked' and created_at >= ${monthStart} order by created_at limit $2)`, [businessId, room]);
      unlocked = n ?? 0;
    }
    return { unlocked };
  });
  if (result) await audit(user, 'business_plan', 'business', businessId, { planKey, note, unlocked: result.unlocked });
  return result;
}

export async function adminListRequests(user: SessionUser) {
  assertAdmin(user);
  return query<{ id: string; category: string; description: string; postcode: string; status: string; hidden: boolean; created_at: string; customer_email: string; leads: number }>(
    `select r.id, r.category, r.description, r.postcode, r.status, r.hidden, r.created_at, u.email as customer_email,
            (select count(*)::int from leads l where l.request_id = r.id) as leads
       from service_requests r join users u on u.id = r.customer_id order by r.created_at desc limit 300`);
}

export async function adminHideRequest(user: SessionUser, requestId: string, hidden: boolean, reason: string | null) {
  assertAdmin(user);
  if (!isId(requestId)) return false;
  const row = await queryOne('update service_requests set hidden = $2, hidden_reason = $3 where id = $1 returning id', [requestId, hidden, reason]);
  if (row) await audit(user, hidden ? 'request_hidden' : 'request_unhidden', 'request', requestId, { reason });
  return Boolean(row);
}

export async function adminListReviews(user: SessionUser) {
  assertAdmin(user);
  return query<{ id: string; rating: number; body: string; hidden: boolean; created_at: string; business_name: string; customer_email: string }>(
    `select r.id, r.rating, r.body, r.hidden, r.created_at, b.name as business_name, u.email as customer_email
       from reviews r join businesses b on b.id = r.business_id join users u on u.id = r.customer_id order by r.created_at desc limit 300`);
}

export async function adminHideReview(user: SessionUser, reviewId: string, hidden: boolean, reason: string | null) {
  assertAdmin(user);
  if (!isId(reviewId)) return false;
  const row = await queryOne('update reviews set hidden = $2, hidden_reason = $3 where id = $1 returning id', [reviewId, hidden, reason]);
  if (row) await audit(user, hidden ? 'review_hidden' : 'review_unhidden', 'review', reviewId, { reason });
  return Boolean(row);
}

export async function adminListUsers(user: SessionUser, search = '') {
  assertAdmin(user);
  const q = `%${search.trim().toLowerCase().slice(0, 100)}%`;
  return query<{ id: string; email: string; full_name: string; phone: string | null; role: Role; disabled_at: string | null; created_at: string; last_login_at: string | null }>(
    `select id, email, full_name, phone, role, disabled_at, created_at, last_login_at from users
      where $1 = '%%' or lower(email::text) like $1 or lower(full_name) like $1 order by created_at desc limit 300`, [q]);
}

export async function adminSetUserRole(user: SessionUser, userId: string, role: Role) {
  assertAdmin(user);
  if (!isId(userId) || !['customer', 'provider', 'admin'].includes(role)) return 'invalid_request';
  if (userId === user.id && role !== 'admin') return 'cannot_demote_self';
  const row = await queryOne('update users set role = $2 where id = $1 returning id', [userId, role]);
  if (row) await audit(user, 'user_role', 'user', userId, { role });
  return row ? 'ok' : 'not_found';
}

export async function adminSetUserDisabled(user: SessionUser, userId: string, disabled: boolean) {
  assertAdmin(user);
  if (!isId(userId)) return 'invalid_request';
  if (userId === user.id) return 'cannot_disable_self';
  const row = await queryOne(`update users set disabled_at = case when $2 then now() else null end where id = $1 returning id`, [userId, disabled]);
  if (disabled) await query('delete from sessions where user_id = $1', [userId]);
  if (row) await audit(user, disabled ? 'user_disabled' : 'user_enabled', 'user', userId);
  return row ? 'ok' : 'not_found';
}

export async function adminListLeads(user: SessionUser) {
  assertAdmin(user);
  return query<{ id: string; status: string; created_at: string; business_name: string; category: string; postcode: string }>(
    `select l.id, l.status, l.created_at, b.name as business_name, r.category, r.postcode
       from leads l join businesses b on b.id = l.business_id join service_requests r on r.id = l.request_id order by l.created_at desc limit 300`);
}

export async function adminListInbox(user: SessionUser) {
  assertAdmin(user);
  const contact = await query<{ id: string; name: string; email: string; subject: string; body: string; status: string; created_at: string }>('select id, name, email, subject, body, status, created_at from contact_messages order by created_at desc limit 100');
  const submissions = await query<{ id: string; kind: string; name: string; email: string; title: string; description: string; status: string; created_at: string }>('select id, kind, name, email, title, description, status, created_at from community_submissions order by created_at desc limit 100');
  const emails = await query<{ to_address: string; subject: string; kind: string; status: string; error: string | null; created_at: string }>('select to_address, subject, kind, status, error, created_at from email_outbox order by created_at desc limit 50');
  return { contact, submissions, emails };
}

export async function adminSetContactStatus(user: SessionUser, id: string, status: 'new' | 'handled' | 'spam') {
  assertAdmin(user);
  if (!isId(id) || !['new', 'handled', 'spam'].includes(status)) return false;
  return Boolean(await queryOne('update contact_messages set status = $2 where id = $1 returning id', [id, status]));
}

/** Audit entry for actions that live outside this file (admin console). */
export async function auditRaw(actor: SessionUser, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  assertAdmin(actor);
  await audit(actor, action, targetType, targetId, { actor_email: actor.email, ...details });
}

export async function ownerOf(businessId: string) {
  if (!isId(businessId)) return null;
  return queryOne<{ email: string; locale: 'nl' | 'en' }>('select u.email, u.locale from businesses b join users u on u.id = b.owner_id where b.id = $1', [businessId]);
}
