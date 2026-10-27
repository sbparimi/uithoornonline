'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Send } from 'lucide-react';
import { dateLocale } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';

type Message = { id: string; sender_id: string; body: string; created_at: string };

export function ConversationThread({ conversationId, currentUserId, initialMessages }: { conversationId: string; currentUserId: string; initialMessages: Message[] }) {
  const lang = useLang();
  const m = useDict().messages;
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState(''); const [sending, setSending] = useState(false); const [error, setError] = useState(''); const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  // Poll for new messages every 5 s while the tab is visible (replaces Supabase realtime).
  const latest = useRef<string | undefined>(initialMessages[initialMessages.length - 1]?.created_at);
  const poll = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    try {
      const qs = latest.current ? `?since=${encodeURIComponent(latest.current)}` : '';
      const res = await fetch(`/api/conversations/${conversationId}/messages${qs}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json() as { messages: (Message & { mine: boolean })[] };
      if (!data.messages?.length) return;
      latest.current = data.messages[data.messages.length - 1].created_at;
      setMessages(current => {
        const known = new Set(current.map(m => m.id));
        const fresh = data.messages.filter(m => !known.has(m.id)).map(m => ({ id: m.id, sender_id: m.mine ? currentUserId : (m.sender_id ?? ''), body: m.body, created_at: m.created_at }));
        return fresh.length ? [...current, ...fresh] : current;
      });
    } catch { /* offline: try again on the next tick */ }
  }, [conversationId, currentUserId]);
  useEffect(() => {
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [poll]);
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
      await poll();
    } catch {
      setBody(text);
      setError(m.errNetwork);
    } finally {
      setSending(false);
    }
  }
  return <section className="conversation-panel"><div className="conversation-messages">{messages.map(message => <div key={message.id} className={`message ${message.sender_id === currentUserId ? 'mine' : 'theirs'}`}><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString(dateLocale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>)}<div ref={bottom} /></div>{error && <p className="platform-error" role="alert" aria-live="assertive">{error}</p>}<form className="message-composer" onSubmit={send}><input value={body} onChange={e => { setBody(e.target.value); if (error) setError(''); }} placeholder={m.placeholder} maxLength={4000} aria-label={m.label} /><button className="primary" disabled={sending || !body.trim()} type="submit"><Send aria-hidden="true" /> <span>{sending ? m.sending : m.send}</span></button></form></section>;
}
