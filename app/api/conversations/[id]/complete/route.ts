import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../lib/supabase/server';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
    const { id } = await params;
    const { error } = await supabase.rpc('complete_conversation', { p_conversation_id: id });
    if (error) {
      console.error('[conversations/complete] failed', { id, code: error.code, message: error.message });
      return NextResponse.json({ error: 'complete_failed' }, { status: 400 });
    }
    return NextResponse.json({ status: 'completed' });
  } catch (error) {
    console.error('[conversations/complete] request failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'complete_failed' }, { status: 500 });
  }
}
