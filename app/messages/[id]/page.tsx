import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { createClient } from '../../../lib/supabase/server';
import { ConversationThread } from '../../../components/conversation-thread';

export default async function MessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/messages/${id}`)}`);
  const { data: conversation } = await supabase.from('conversations').select('id,status,request_id,customer_id,business_id,businesses(name,category,postcode),service_requests(category,description,postcode,preferred_timing)').eq('id', id).maybeSingle();
  if (!conversation) notFound();
  const { data: messages } = await supabase.from('messages').select('id,sender_id,body,created_at').eq('conversation_id', id).order('created_at', { ascending: true });
  const business = Array.isArray((conversation as any).businesses) ? (conversation as any).businesses[0] : (conversation as any).businesses;
  const request = Array.isArray((conversation as any).service_requests) ? (conversation as any).service_requests[0] : (conversation as any).service_requests;
  return <main className="platform-shell"><header className="platform-header"><a className="uo-brand" href="/"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><a href={conversation.customer_id === user.id ? '/account' : '/provider'}>Terug naar dashboard</a></header><div className="message-page"><a className="back-link" href={conversation.customer_id === user.id ? '/account' : '/provider'}><ArrowLeft /> Dashboard</a><div className="conversation-header"><div><span className="uo-kicker">Gesprek</span><h1>{business?.name || 'Lokale aanbieder'}</h1><p><MapPin /> {request?.category || business?.category || 'Lokale aanvraag'} · {request?.postcode || business?.postcode || 'Uithoorn'}</p></div><span className={`conversation-status ${conversation.status}`}>{conversation.status}</span></div><div className="request-context"><strong>Vraag</strong><p>{request?.description}</p><small>Gewenst: {request?.preferred_timing}</small></div><ConversationThread conversationId={id} currentUserId={user.id} initialMessages={messages || []} /></div></main>;
}
