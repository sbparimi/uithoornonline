import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { getCurrentUser } from '../../../../lib/auth/session';
import { getConversation } from '../../../../lib/data/conversations';
import { ConversationThread } from '../../../../components/conversation-thread';
import { ConversationCompleteButton, ReviewForm } from '../../../../components/conversation-actions';
import { AppHeader } from '../../../../components/app-header';
import { isLocale, lp, type Locale } from '../../../../lib/i18n/config';
import { getDictionary, statusLabel } from '../../../../lib/i18n/dictionaries';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === 'en' ? 'Conversation' : 'Gesprek', robots: { index: false, follow: false } };
}

export default async function MessagesPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: raw, id } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const m = t.messages;
  const user = await getCurrentUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, `/messages/${id}`))}`);
  // Authorization: only the resident, the business owner (or an admin, read-only) get the conversation.
  const conversation = await getConversation(user, id);
  if (!conversation) notFound();
  const business = { name: conversation.business_name, category: conversation.business_category, postcode: conversation.business_postcode };
  const request = { category: conversation.category, description: conversation.description, postcode: conversation.postcode, preferred_timing: conversation.preferred_timing };
  const messages = conversation.messages.map((msg) => ({ id: msg.id, sender_id: msg.mine ? user.id : (msg.sender_id ?? ''), body: msg.body, created_at: msg.created_at }));
  const review = conversation.hasReview;
  const isParticipant = conversation.side === 'customer';
  const back = lp(lang, conversation.side === 'customer' ? '/account' : conversation.side === 'admin' ? '/admin' : '/provider');
  const timing = request?.preferred_timing ? (t.requestForm.timing[request.preferred_timing] ?? request.preferred_timing) : '';
  const category = request?.category ? (t.requestForm.categories[request.category] ?? request.category) : (business?.category || m.localRequest);
  return <div className="ds-page"><AppHeader links={[[back, t.common.backToDashboard]]} /><main id="main" className="platform-shell ds-platform"><div className="message-page"><a className="back-link" href={back}><ArrowLeft aria-hidden="true" /> {t.common.dashboard}</a><div className="conversation-header"><div><span className="uo-kicker">{m.kicker}</span><h1>{business?.name || t.common.localProvider}</h1><p><MapPin aria-hidden="true" /> {category} · {request?.postcode || business?.postcode || t.common.town}</p></div><span className={`conversation-status ${conversation.status}`}>{statusLabel(t, conversation.status)}</span></div><div className="request-context"><strong>{m.question}</strong><p>{request?.description}</p>{timing && <small>{m.preferred} {timing}</small>}</div><ConversationThread conversationId={id} currentUserId={user.id} initialMessages={messages || []} />{conversation.status !== 'completed' && conversation.side !== 'admin' && <ConversationCompleteButton conversationId={id} />}{conversation.status === 'completed' && isParticipant && !review && <ReviewForm conversationId={id} />}{conversation.status === 'completed' && isParticipant && review && <div className="review-success"><strong>{m.reviewed}</strong></div>}</div></main></div>;
}
