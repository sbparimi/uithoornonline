import 'server-only';
import { query, queryOne } from '../db';
import type { SessionUser } from '../auth/session';

// AVG/GDPR: right of access & portability (export) and right to erasure (delete).

export async function exportUserData(user: SessionUser) {
  const profile = await queryOne('select id, email, full_name, phone, role, locale, email_verified_at, terms_accepted_at, last_login_at, created_at, updated_at from users where id = $1', [user.id]);
  const businesses = await query('select id, name, category, description, postcode, address, website, phone, moderation_status, verified, featured, active, created_at, updated_at from businesses where owner_id = $1', [user.id]);
  const businessIds = businesses.map((b) => (b as { id: string }).id);
  const subscriptions = businessIds.length ? await query('select business_id, plan_key, status, current_period_end, created_at, updated_at from business_subscriptions where business_id = any($1)', [businessIds]) : [];
  const requests = await query('select id, category, description, postcode, preferred_timing, budget_min, budget_max, urgency, status, created_at, updated_at from service_requests where customer_id = $1 order by created_at', [user.id]);
  const leads = businessIds.length ? await query(`select l.id, l.business_id, l.status, l.created_at, r.category from leads l join service_requests r on r.id = l.request_id where l.business_id = any($1) order by l.created_at`, [businessIds]) : [];
  const conversations = await query(
    `select c.id, c.request_id, c.business_id, c.status, c.created_at,
            coalesce(json_agg(json_build_object('from_me', m.sender_id = $1, 'body', m.body, 'created_at', m.created_at) order by m.created_at) filter (where m.id is not null), '[]') as messages
       from conversations c left join messages m on m.conversation_id = c.id
      where c.customer_id = $1 or c.business_id = any($2::uuid[])
      group by c.id order by c.created_at`, [user.id, businessIds]);
  const reviewsWritten = await query('select id, business_id, rating, body, created_at from reviews where customer_id = $1', [user.id]);
  const reviewsReceived = businessIds.length ? await query('select id, business_id, rating, body, created_at from reviews where business_id = any($1)', [businessIds]) : [];
  const notifications = await query('select type, title, body, read_at, created_at from notifications where user_id = $1 order by created_at', [user.id]);
  return {
    exported_at: new Date().toISOString(),
    controller: 'Uithoorn.online',
    note: 'Export of the personal data Uithoorn.online holds about you (AVG/GDPR art. 15 and 20).',
    profile, businesses, subscriptions, requests, leads, conversations,
    reviews_written: reviewsWritten, reviews_received: reviewsReceived, notifications,
  };
}

/**
 * Permanently deletes the account and everything that belongs to it (cascades: sessions, businesses
 * owned, requests, leads, conversations and their messages, reviews, notifications).
 * Messages the user sent in other people's conversations keep their text but lose the author link.
 */
export async function deleteAccount(user: SessionUser) {
  const summary = await queryOne<{ requests: number; businesses: number }>(
    'select (select count(*)::int from service_requests where customer_id = $1) as requests, (select count(*)::int from businesses where owner_id = $1) as businesses', [user.id]);
  await query('delete from users where id = $1', [user.id]);
  await query(`insert into audit_log(actor_id, action, target_type, target_id, details) values (null, 'account_deleted_self', 'user', $1, $2)`, [user.id, JSON.stringify(summary ?? {})]);
  return summary;
}
