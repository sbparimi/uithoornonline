import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
    const body = await request.json();
    const conversationId = String(body.conversationId || '').trim();
    const rating = Number(body.rating);
    const reviewBody = String(body.body || '').trim();
    if (!conversationId || !Number.isInteger(rating) || rating < 1 || rating > 5 || reviewBody.length > 1000) return NextResponse.json({ error: 'invalid_review' }, { status: 400 });
    const { data: conversation } = await supabase.from('conversations').select('id,request_id,customer_id,business_id,status').eq('id', conversationId).eq('customer_id', user.id).eq('status', 'completed').maybeSingle();
    if (!conversation) return NextResponse.json({ error: 'review_not_allowed' }, { status: 403 });
    const { data, error } = await supabase.from('reviews').insert({ conversation_id: conversation.id, request_id: conversation.request_id, business_id: conversation.business_id, customer_id: user.id, rating, body: reviewBody }).select('id').single();
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'already_reviewed' : 'review_save_failed' }, { status: error.code === '23505' ? 409 : 500 });
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error('[reviews] request failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'review_save_failed' }, { status: 500 });
  }
}
