import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { createClient } from '../../../../lib/supabase/server';
import { ConversationThread } from '../../../../components/conversation-thread';
import { ConversationCompleteButton, ReviewForm } from '../../../../components/conversation-actions';
import { AppHeader } from '../../../../components/app-header';
import { isLocale, lp, type Locale } from '../../../../lib/i18n/config';
import { getDictionary, statusLabel } from '../../../../lib/i18n/dictionaries';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MessagesPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: raw, id } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const m = t.messages;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, `/messages/${id}`))}`);
  const { data: conversation } = await supabase.from('conversations').select('id,status,request_id,customer_id,business_id,businesses(name,category,postcode),service_requests(category,description,postcode,preferred_timing)').eq('id', id).maybeSingle();
  if (!conversation) notFound();
  const [{ data: messages }, { data: review }] = await Promise.all([
    supabase.from('messages').select('id,sender_id,body,created_at').eq('conversation_id', id).order('created_at', { ascending: true }),
    supabase.from('reviews').select('id').eq('conversation_id', id).eq('customer_id', conversation.customer_id).maybeSingle(),
  ]);
  const business = Array.isArray((conversation as any).businesses) ? (conversation as any).businesses[0] : (conversation as any).businesses;
  const request = Array.isArray((conversation as any).service_requests) ? (conversation as any).service_requests[0] : (conversation as any).service_requests;
  const isParticipant = conversation.customer_id === user.id;
  const back = lp(lang, isParticipant ? '/account' : '/provider');
  const timing = request?.preferred_timing ? (t.requestForm.timing[request.preferred_timing] ?? request.preferred_timing) : '';
  const category = request?.category ? (t.requestForm.categories[request.category] ?? request.category) : (business?.category || m.localRequest);
  return <div className="ds-page"><AppHeader links={[[back, t.common.backToDashboard]]} /><main id="main" className="platform-shell ds-platform"><div className="message-page"><a className="back-link" href={back}><ArrowLeft aria-hidden="true" /> {t.common.dashboard}</a><div className="conversation-header"><div><span className="uo-kicker">{m.kicker}</span><h1>{business?.name || t.common.localProvider}</h1><p><MapPin aria-hidden="true" /> {category} · {request?.postcode || business?.postcode || t.common.town}</p></div><span className={`conversation-status ${conversation.status}`}>{statusLabel(t, conversation.status)}</span></div><div className="request-context"><strong>{m.question}</strong><p>{request?.description}</p>{timing && <small>{m.preferred} {timing}</small>}</div><ConversationThread conversationId={id} currentUserId={user.id} initialMessages={messages || []} />{conversation.status !== 'completed' && <ConversationCompleteButton conversationId={id} />}{conversation.status === 'completed' && isParticipant && !review && <ReviewForm conversationId={id} />}{conversation.status === 'completed' && isParticipant && review && <div className="review-success"><strong>{m.reviewed}</strong></div>}</div></main></div>;
}
