'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Send } from 'lucide-react';
import { createClient } from '../lib/supabase/client';

type Message = { id: string; sender_id: string; body: string; created_at: string };

export function ConversationThread({ conversationId, currentUserId, initialMessages }: { conversationId: string; currentUserId: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState(''); const [sending, setSending] = useState(false); const bottom = useRef<HTMLDivElement>(null);
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
    e.preventDefault(); if (!body.trim() || sending) return; setSending(true);
    const text = body.trim(); setBody('');
    const response = await fetch(`/api/conversations/${conversationId}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: text }) });
    if (!response.ok) setBody(text);
    setSending(false);
  }
  return <section className="conversation-panel"><div className="conversation-messages">{messages.map(message => <div key={message.id} className={`message ${message.sender_id === currentUserId ? 'mine' : 'theirs'}`}><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>)}<div ref={bottom} /></div><form className="message-composer" onSubmit={send}><input value={body} onChange={e => setBody(e.target.value)} placeholder="Schrijf een bericht…" maxLength={4000} aria-label="Bericht" /><button className="primary" disabled={sending || !body.trim()} type="submit"><Send /> <span>{sending ? 'Versturen…' : 'Versturen'}</span></button></form></section>;
}
