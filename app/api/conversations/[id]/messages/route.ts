import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const message = String(body.body || '').trim();
    if (!message || message.length > 4000) return NextResponse.json({ error: 'invalid_message' }, { status: 400 });
    const { data: messageId, error } = await supabase.rpc('send_conversation_message', { p_conversation_id: id, p_body: message });
    if (error) {
      console.error('[messages] send failed', { conversationId: id, code: error.code, message: error.message });
      const unavailable = /not found|conversation|participant|access|closed/i.test(error.message || '');
      return NextResponse.json({ error: unavailable ? 'conversation_not_available' : 'message_send_failed' }, { status: 400 });
    }
    if (!messageId) return NextResponse.json({ error: 'message_send_failed' }, { status: 500 });
    return NextResponse.json({ id: messageId }, { status: 201 });
  } catch (error) {
    console.error('[messages] request failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'message_send_failed' }, { status: 500 });
  }
}
