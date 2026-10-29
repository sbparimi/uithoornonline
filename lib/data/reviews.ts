import 'server-only';
import { queryOne } from '../db';
import type { SessionUser } from '../auth/session';

export async function createReview(user: SessionUser, conversationId: string, rating: number, body: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) return { error: 'review_not_allowed' as const };
  const c = await queryOne<{ id: string; request_id: string; business_id: string; business_name: string }>(
    `select c.id, c.request_id, c.business_id, b.name as business_name from conversations c join businesses b on b.id = c.business_id
      where c.id = $1 and c.customer_id = $2 and c.status = 'completed'`, [conversationId, user.id]);
  if (!c) return { error: 'review_not_allowed' as const };
  try {
    const row = await queryOne<{ id: string }>(
      'insert into reviews(conversation_id, request_id, business_id, customer_id, rating, body) values ($1,$2,$3,$4,$5,$6) returning id',
      [c.id, c.request_id, c.business_id, user.id, rating, body]);
    return { id: row!.id, businessName: c.business_name };
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return { error: 'already_reviewed' as const };
    throw error;
  }
}
