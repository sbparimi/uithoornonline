import 'server-only';
import { query, queryOne, transaction } from '../db';
import type { SessionUser } from '../auth/session';

type Participant = { id: string; status: string; request_id: string; customer_id: string; business_id: string; business_owner: string | null; business_name: string };

async function participantConversation(user: SessionUser, id: string): Promise<(Participant & { side: 'customer' | 'business' | 'admin' }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const c = await queryOne<Participant>(
    `select c.id, c.status, c.request_id, c.customer_id, c.business_id, b.owner_id as business_owner, b.name as business_name
       from conversations c join businesses b on b.id = c.business_id where c.id = $1`, [id]);
  if (!c) return null;
  if (c.customer_id === user.id) return { ...c, side: 'customer' };
  if (c.business_owner === user.id) return { ...c, side: 'business' };
  if (user.role === 'admin') return { ...c, side: 'admin' };
  return null;
}

export async function getConversation(user: SessionUser, id: string) {
  const c = await participantConversation(user, id);
  if (!c) return null;
  const detail = await queryOne<{ business_name: string; business_category: string; business_postcode: string | null; category: string; description: string; postcode: string; preferred_timing: string; customer_name: string }>(
    `select b.name as business_name, b.category as business_category, b.postcode as business_postcode,
            r.category, r.description, r.postcode, r.preferred_timing,
            coalesce(nullif(split_part(u.full_name, ' ', 1), ''), 'Inwoner') as customer_name
       from conversations c join businesses b on b.id = c.business_id join service_requests r on r.id = c.request_id join users u on u.id = c.customer_id
      where c.id = $1`, [id]);
  const messages = await listMessages(user, id);
  const reviewed = await queryOne<{ id: string }>('select id from reviews where conversation_id = $1', [id]);
  return { id: c.id, status: c.status, side: c.side, hasReview: Boolean(reviewed), ...detail!, messages: messages ?? [] };
}

export async function listMessages(user: SessionUser, conversationId: string, since?: string) {
  const c = await participantConversation(user, conversationId);
  if (!c) return null;
  const params: unknown[] = [conversationId];
  let extra = '';
  if (since && !Number.isNaN(Date.parse(since))) { params.push(new Date(since)); extra = ' and created_at > $2'; }
  const rows = await query<{ id: string; sender_id: string | null; body: string; created_at: string }>(`select id, sender_id, body, created_at from messages where conversation_id = $1${extra} order by created_at limit 500`, params);
  return rows.map((m) => ({ ...m, mine: m.sender_id === user.id }));
}

export async function sendMessage(user: SessionUser, conversationId: string, body: string) {
  const c = await participantConversation(user, conversationId);
  if (!c || c.side === 'admin') return { error: 'conversation_not_available' as const };
  if (!['active', 'scheduled'].includes(c.status)) return { error: 'conversation_closed' as const };
  const recipientId = c.side === 'customer' ? c.business_owner : c.customer_id;
  const id = await transaction(async (client) => {
    const { rows: [m] } = await client.query<{ id: string }>('insert into messages(conversation_id, sender_id, body) values ($1, $2, $3) returning id', [conversationId, user.id, body]);
    await client.query('update conversations set updated_at = now() where id = $1', [conversationId]);
    if (recipientId) await client.query(`insert into notifications(user_id, type, title, body, conversation_id) values ($1, 'new_message', 'Nieuw bericht op Uithoorn.online', left($2, 180), $3)`, [recipientId, body, conversationId]);
    return m.id;
  });
  const recipient = recipientId ? await queryOne<{ email: string; locale: 'nl' | 'en' }>('select email, locale from users where id = $1', [recipientId]) : null;
  return { id, recipient };
}

export async function completeConversation(user: SessionUser, conversationId: string) {
  const c = await participantConversation(user, conversationId);
  if (!c || c.side === 'admin') return false;
  await transaction(async (client) => {
    await client.query(`update conversations set status = 'completed' where id = $1`, [conversationId]);
    await client.query(`update service_requests set status = 'completed' where id = $1`, [c.request_id]);
    await client.query(`insert into notifications(user_id, type, title, body, conversation_id, request_id) values ($1, 'request_update', 'Opdracht afgerond', 'Je gesprek is gemarkeerd als afgerond. Laat een beoordeling achter voor de aanbieder.', $2, $3)`, [c.customer_id, conversationId, c.request_id]);
  });
  return true;
}

/** A business owner accepts a lead: opens the conversation with the resident. */
export async function acceptRequest(user: SessionUser, requestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { error: 'request_not_available' as const };
  const lead = await queryOne<{ lead_id: string; business_id: string; business_name: string; status: string; customer_id: string; customer_email: string; customer_locale: 'nl' | 'en'; hidden: boolean }>(
    `select l.id as lead_id, l.business_id, b.name as business_name, l.status, r.customer_id, u.email as customer_email, u.locale as customer_locale, r.hidden
       from leads l join businesses b on b.id = l.business_id join service_requests r on r.id = l.request_id join users u on u.id = r.customer_id
      where l.request_id = $1 and b.owner_id = $2 limit 1`, [requestId, user.id]);
  if (!lead || lead.hidden) return { error: 'request_not_available' as const };
  if (lead.status === 'locked') return { error: 'lead_limit_reached' as const };
  const conversationId = await transaction(async (client) => {
    await client.query(`update request_providers set status = 'accepted', responded_at = now() where request_id = $1 and business_id = $2`, [requestId, lead.business_id]);
    await client.query(`update leads set status = 'accepted', accepted_at = now() where id = $1`, [lead.lead_id]);
    const { rows: [conv] } = await client.query<{ id: string }>(
      `insert into conversations(request_id, customer_id, business_id, status) values ($1, $2, $3, 'active')
       on conflict (request_id, business_id) do update set status = 'active', updated_at = now() returning id`, [requestId, lead.customer_id, lead.business_id]);
    await client.query(`update service_requests set status = 'in_conversation' where id = $1`, [requestId]);
    await client.query(`insert into notifications(user_id, type, title, body, conversation_id, request_id) values ($1, 'request_update', 'Een aanbieder heeft gereageerd', 'Een lokale aanbieder heeft jouw aanvraag geaccepteerd. Je kunt nu berichten.', $2, $3)`, [lead.customer_id, conv.id, requestId]);
    return conv.id;
  });
  return { conversationId, businessName: lead.business_name, customerEmail: lead.customer_email, customerLocale: lead.customer_locale };
}

export async function listConversationsForUser(user: SessionUser) {
  return query<{ id: string; status: string; updated_at: string; business_name: string; category: string; side: string }>(
    `select c.id, c.status, c.updated_at, b.name as business_name, r.category,
            case when c.customer_id = $1 then 'customer' else 'business' end as side
       from conversations c join businesses b on b.id = c.business_id join service_requests r on r.id = c.request_id
      where c.customer_id = $1 or b.owner_id = $1 order by c.updated_at desc limit 100`, [user.id]);
}
