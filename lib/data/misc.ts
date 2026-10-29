import 'server-only';
import { query, queryOne } from '../db';

export async function createContactMessage(input: { name: string; email: string; subject: string; body: string }) {
  return queryOne<{ id: string }>('insert into contact_messages(name, email, subject, body) values ($1,$2,$3,$4) returning id', [input.name, input.email, input.subject, input.body]);
}

export async function createCommunitySubmission(input: { kind: string; name: string; email: string; phone: string | null; title: string; description: string; category: string | null; postcode: string | null; website: string | null }) {
  return queryOne<{ id: string }>(
    `insert into community_submissions(kind, name, email, phone, title, description, category, postcode, website) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [input.kind, input.name, input.email, input.phone, input.title, input.description, input.category, input.postcode, input.website]);
}

export const ANALYTICS_EVENTS = new Set(['page_view', 'search', 'search_result_click', 'business_view', 'business_contact', 'phone_click', 'whatsapp_click', 'website_click', 'request_started', 'request_submitted', 'lead_created', 'promotion_impression', 'promotion_click']);

/** Anonymous first-party counters. No cookie, no IP, no session id is stored. */
export async function trackEvent(name: string, businessId: string | null, requestId: string | null, metadata: Record<string, unknown>) {
  const uuid = (v: string | null) => (v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null);
  const meta = JSON.stringify(metadata).length <= 2000 ? metadata : {};
  await query(
    `insert into analytics_events(event_name, business_id, request_id, metadata)
     select $1, (select id from businesses where id = $2::uuid), (select id from service_requests where id = $3::uuid), $4`,
    [name, uuid(businessId), uuid(requestId), JSON.stringify(meta)]);
}
