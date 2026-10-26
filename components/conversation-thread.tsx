'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Send } from 'lucide-react';
import { createClient } from '../lib/supabase/client';
import { dateLocale } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';

type Message = { id: string; sender_id: string; body: string; created_at: string };

export function ConversationThread({ conversationId, currentUserId, initialMessages }: { conversationId: string; currentUserId: string; initialMessages: Message[] }) {
  const lang = useLang();
  const m = useDict().messages;
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState(''); const [sending, setSending] = useState(false); const [error, setError] = useState(''); const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`conversation:${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, payload => {
      const incoming = payload.new as Message;
      setMessages(current => current.some(m => m.id === incoming.id) ? current : [...current, incoming]);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);
  async function send(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true); setError(''); setBody('');
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: text }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBody(text);
        setError(data.error === 'login_required' ? m.errSession : data.error === 'conversation_not_available' ? m.errUnavailable : m.errSend);
        return;
      }
    } catch {
      setBody(text);
      setError(m.errNetwork);
    } finally {
      setSending(false);
    }
  }
  return <section className="conversation-panel"><div className="conversation-messages">{messages.map(message => <div key={message.id} className={`message ${message.sender_id === currentUserId ? 'mine' : 'theirs'}`}><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString(dateLocale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>)}<div ref={bottom} /></div>{error && <p className="platform-error" role="alert" aria-live="assertive">{error}</p>}<form className="message-composer" onSubmit={send}><input value={body} onChange={e => { setBody(e.target.value); if (error) setError(''); }} placeholder={m.placeholder} maxLength={4000} aria-label={m.label} /><button className="primary" disabled={sending || !body.trim()} type="submit"><Send aria-hidden="true" /> <span>{sending ? m.sending : m.send}</span></button></form></section>;
}
