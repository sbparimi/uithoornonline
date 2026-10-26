import 'server-only';
import { query, queryOne } from '../db';
import type { SessionUser } from '../auth/session';
import { planUsage } from './plans';

export type LeadView = {
  id: string; status: string; created_at: string; request_id: string; category: string;
  // Details are null for locked leads (over the plan limit). Never includes the resident's
  // email or phone: contact happens through the conversation after the business accepts.
  description: string | null; postcode: string | null; preferred_timing: string | null; urgency: string | null;
  budget_min: string | null; budget_max: string | null; conversation_id: string | null;
};

export async function listLeadsForOwner(user: SessionUser) {
  const business = await queryOne<{ id: string; name: string }>('select id, name from businesses where owner_id = $1 order by created_at limit 1', [user.id]);
  if (!business) return null;
  const leads = await query<LeadView>(
    `select l.id, l.status, l.created_at, r.id as request_id, r.category,
            case when l.status = 'locked' then null else r.description end as description,
            case when l.status = 'locked' then null else r.postcode end as postcode,
            case when l.status = 'locked' then null else r.preferred_timing end as preferred_timing,
            case when l.status = 'locked' then null else r.urgency end as urgency,
            case when l.status = 'locked' then null else r.budget_min::text end as budget_min,
            case when l.status = 'locked' then null else r.budget_max::text end as budget_max,
            c.id as conversation_id
       from leads l join service_requests r on r.id = l.request_id
       left join conversations c on c.request_id = l.request_id and c.business_id = l.business_id
      where l.business_id = $1 and r.hidden = false
      order by l.created_at desc limit 200`, [business.id]);
  const usage = await planUsage(business.id);
  return { business, leads, usage };
}

const ALLOWED = ['viewed', 'accepted', 'declined', 'contacted', 'converted', 'closed'];

export async function updateLeadStatus(user: SessionUser, leadId: string, status: string) {
  if (!ALLOWED.includes(status) || !/^[0-9a-f-]{36}$/i.test(leadId)) return 'invalid_request' as const;
  const row = await queryOne<{ id: string }>(
    `update leads l set status = $3,
            viewed_at = case when $3 = 'viewed' and l.viewed_at is null then now() else l.viewed_at end,
            accepted_at = case when $3 = 'accepted' then now() else l.accepted_at end,
            contacted_at = case when $3 = 'contacted' then now() else l.contacted_at end,
            converted_at = case when $3 = 'converted' then now() else l.converted_at end
      from businesses b
      where l.id = $1 and b.id = l.business_id and b.owner_id = $2 and l.status <> 'locked'
      returning l.id`, [leadId, user.id, status]);
  return row ? 'ok' as const : 'not_authorized' as const;
}
