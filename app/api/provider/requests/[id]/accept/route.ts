import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../lib/supabase/server';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
    const { id } = await params;
    const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!business) return NextResponse.json({ error: 'provider_required' }, { status: 403 });
    const { data: conversationId, error } = await supabase.rpc('accept_service_request', { p_request_id: id, p_business_id: business.id });
    if (error) {
      console.error('[provider/accept] failed', { requestId: id, code: error.code, message: error.message });
      const unavailable = /not found|not available|already|status|invited/i.test(error.message || '');
      return NextResponse.json({ error: unavailable ? 'request_not_available' : 'accept_failed' }, { status: 400 });
    }
    if (!conversationId) return NextResponse.json({ error: 'accept_failed' }, { status: 500 });
    return NextResponse.json({ conversationId }, { status: 200 });
  } catch (error) {
    console.error('[provider/accept] request failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'accept_failed' }, { status: 500 });
  }
}
