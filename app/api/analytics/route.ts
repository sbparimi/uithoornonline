import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

const allowed = new Set(['page_view','search','search_result_click','business_view','business_contact','phone_click','whatsapp_click','website_click','request_started','request_submitted','lead_created','promotion_impression','promotion_click']);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventName = String(body.eventName || '').trim();
    if (!allowed.has(eventName)) return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('analytics_events').insert({
      event_name: eventName,
      business_id: body.businessId || null,
      request_id: body.requestId || null,
      promotion_id: body.promotionId || null,
      session_id: String(body.sessionId || '').slice(0, 120) || null,
      metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {},
    });
    if (error) return NextResponse.json({ error: 'analytics_failed' }, { status: 500 });
    return NextResponse.json({ ok: true, authenticated: Boolean(user) });
  } catch {
    return NextResponse.json({ error: 'analytics_failed' }, { status: 400 });
  }
}
