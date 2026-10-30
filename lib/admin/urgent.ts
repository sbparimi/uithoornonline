import 'server-only';
import { query, queryOne } from '../db';
import type { SessionUser } from '../auth/session';
import { assertAdmin, isId, optional } from './core';

// Admin → Spoed: intake/urgent requests with alert log per channel and accept times.
export type UrgentRow = {
  id: string; category: string; postcode: string; urgency_level: string | null; source: string; status: string; created_at: string;
  alerts_sent_at: string | null; accepted_at: string | null; accepted_via: string | null; business_name: string | null; escalation_stage: string;
  contact_name: string | null; contact_phone: string | null; email_sent: number; sms_sent: number; whatsapp_sent: number; voice_sent: number; failed: number; businesses: number; photos: number;
};

export async function listUrgent(user: SessionUser) {
  assertAdmin(user);
  return optional(() => query<UrgentRow>(
    `select r.id, r.category, r.postcode, r.urgency_level, r.source, r.status::text, r.created_at, r.alerts_sent_at, r.accepted_at, r.accepted_via, b.name as business_name,
            r.escalation_stage, r.contact_name, r.contact_phone,
            count(a.id) filter (where a.channel = 'email' and a.status = 'sent' and a.audience = 'business')::int as email_sent,
            count(a.id) filter (where a.channel = 'sms' and a.status = 'sent')::int as sms_sent,
            count(a.id) filter (where a.channel = 'whatsapp' and a.status = 'sent')::int as whatsapp_sent,
            count(a.id) filter (where a.channel = 'voice' and a.status = 'sent')::int as voice_sent,
            count(a.id) filter (where a.status = 'failed')::int as failed,
            count(distinct a.business_id)::int as businesses,
            (select count(*)::int from request_photos p where p.request_id = r.id) as photos
       from service_requests r left join businesses b on b.id = r.accepted_business_id left join job_alerts a on a.request_id = r.id
      where r.source = 'intake' or r.urgency_level is not null or exists (select 1 from job_alerts x where x.request_id = r.id)
      group by r.id, b.name order by r.created_at desc limit 100`), [] as UrgentRow[]);
}

export type AlertLog = { id: string; created_at: string; audience: string; channel: string; stage: string; status: string; recipient: string | null; provider_id: string | null; error: string | null; business_name: string | null };

export async function urgentDetail(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return null;
  const r = await optional(() => queryOne<UrgentRow & { description: string; intake: Record<string, unknown> | null; contact_email: string | null }>(
    `select r.id, r.category, r.description, r.postcode, r.urgency_level, r.source, r.status::text, r.created_at, r.alerts_sent_at, r.accepted_at, r.accepted_via, r.escalation_stage,
            r.contact_name, r.contact_phone, r.contact_email, r.intake, b.name as business_name, (select count(*)::int from request_photos p where p.request_id = r.id) as photos
       from service_requests r left join businesses b on b.id = r.accepted_business_id where r.id = $1`, [id]), null);
  if (!r) return null;
  const log = await query<AlertLog>(
    `select a.id, a.created_at, a.audience, a.channel, a.stage, a.status, a.recipient, a.provider_id, a.error, b.name as business_name
       from job_alerts a left join businesses b on b.id = a.business_id where a.request_id = $1 order by a.created_at, a.id`, [id]);
  return { request: r, log };
}

export async function urgentBusinesses(user: SessionUser) {
  assertAdmin(user);
  return optional(() => query<{ id: string; name: string; category: string; alert_email: boolean; alert_sms: boolean; alert_whatsapp: boolean; alert_phone: string | null; spoed_24_7: boolean; quiet_start: string | null; quiet_end: string | null }>(
    `select id, name, category, alert_email, alert_sms, alert_whatsapp, alert_phone, spoed_24_7, quiet_start::text, quiet_end::text
       from businesses where moderation_status = 'approved' and active order by spoed_24_7 desc, name`), []);
}
