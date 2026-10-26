import 'server-only';
import { query, queryOne } from '../db';
import type { SessionUser } from '../auth/session';
import { planUsage } from './plans';

export async function getResidentDashboard(user: SessionUser) {
  const [requests, conversations, notifications] = await Promise.all([
    query<{ id: string; category: string; description: string; postcode: string; preferred_timing: string; status: string; created_at: string }>(
      'select id, category, description, postcode, preferred_timing, status, created_at from service_requests where customer_id = $1 order by created_at desc limit 20', [user.id]),
    query<{ id: string; status: string; updated_at: string; business_name: string; category: string }>(
      `select c.id, c.status, c.updated_at, b.name as business_name, r.category from conversations c join businesses b on b.id = c.business_id join service_requests r on r.id = c.request_id
        where c.customer_id = $1 order by c.updated_at desc limit 20`, [user.id]),
    query<{ id: string; title: string; body: string; read_at: string | null; created_at: string }>(
      'select id, title, body, read_at, created_at from notifications where user_id = $1 order by created_at desc limit 10', [user.id]),
  ]);
  return { requests, conversations, notifications };
}

export async function getProviderDashboard(user: SessionUser) {
  const business = await queryOne<{ id: string; name: string; category: string; postcode: string | null; verified: boolean; active: boolean; moderation_status: 'pending' | 'approved' | 'rejected' }>(
    'select id, name, category, postcode, verified, active, moderation_status from businesses where owner_id = $1 order by created_at limit 1', [user.id]);
  if (!business) return null;
  const [plan, usage, leads, conversations, notifications, counts] = await Promise.all([
    queryOne<{ name: string; monthly_price_cents: number; included_leads: number; featured: boolean }>(
      `select p.name, p.monthly_price_cents, p.included_leads, p.featured from business_plans p
        left join business_subscriptions s on s.business_id = $1 and s.status in ('active','trialing','past_due') where p.key = coalesce(s.plan_key, 'free')`, [business.id]),
    planUsage(business.id),
    query<{ id: string; request_id: string; status: string; created_at: string; category: string; description: string | null; postcode: string | null; preferred_timing: string | null }>(
      `select l.id, l.request_id, l.status, l.created_at, r.category,
              case when l.status = 'locked' then null else r.description end as description,
              case when l.status = 'locked' then null else r.postcode end as postcode,
              case when l.status = 'locked' then null else r.preferred_timing end as preferred_timing
         from leads l join service_requests r on r.id = l.request_id
        where l.business_id = $1 and r.hidden = false order by l.created_at desc limit 30`, [business.id]),
    query<{ id: string; status: string; updated_at: string; category: string; description: string }>(
      `select c.id, c.status, c.updated_at, r.category, r.description from conversations c join service_requests r on r.id = c.request_id
        where c.business_id = $1 order by c.updated_at desc limit 20`, [business.id]),
    query<{ id: string; title: string; body: string; read_at: string | null; created_at: string }>(
      'select id, title, body, read_at, created_at from notifications where user_id = $1 order by created_at desc limit 8', [user.id]),
    queryOne<{ views: number; contacts: number }>(
      `select count(*) filter (where event_name = 'business_view')::int as views,
              count(*) filter (where event_name in ('business_contact','phone_click','whatsapp_click','website_click'))::int as contacts
         from analytics_events where business_id = $1 and created_at > now() - interval '30 days'`, [business.id]),
  ]);
  const accepted = new Set((await query<{ request_id: string }>('select request_id from conversations where business_id = $1', [business.id])).map((r) => r.request_id));
  const pending = leads.filter((l) => (l.status === 'new' || l.status === 'viewed') && !accepted.has(l.request_id));
  return { business, plan: plan ?? { name: 'Gratis', monthly_price_cents: 0, included_leads: 3, featured: false }, usage, leads, pending, conversations, notifications, views: counts?.views ?? 0, contacts: counts?.contacts ?? 0 };
}
