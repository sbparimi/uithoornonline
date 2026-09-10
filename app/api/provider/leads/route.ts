import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
    const body = await request.json();
    const leadId = String(body.leadId || '');
    const status = String(body.status || '');
    if (!leadId || !['viewed','accepted','declined','contacted','converted','closed'].includes(status)) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    const { error } = await supabase.rpc('update_lead_status', { p_lead_id: leadId, p_status: status });
    if (error) return NextResponse.json({ error: error.message === 'not_authorized' ? 'not_authorized' : 'update_failed' }, { status: error.message === 'not_authorized' ? 403 : 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}
