import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const message = String(body.body || '').trim();
  if (!message || message.length > 4000) return NextResponse.json({ error: 'invalid_message' }, { status: 400 });
  const { data: messageId, error } = await supabase.rpc('send_conversation_message', { p_conversation_id: id, p_body: message });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: messageId }, { status: 201 });
}
