'use client';

import { FormEvent, useState } from 'react';
import { Check, Star } from 'lucide-react';

export function ConversationCompleteButton({ conversationId }: { conversationId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function complete() {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/conversations/${conversationId}/complete`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error === 'login_required' ? 'Log opnieuw in.' : 'Afronden is niet gelukt.'); return; }
      window.location.reload();
    } catch { setError('Controleer je verbinding en probeer opnieuw.'); }
    finally { setLoading(false); }
  }
  return <div className="conversation-action"><button className="secondary compact-button" onClick={complete} disabled={loading}><Check size={15} />{loading ? 'Afronden…' : 'Markeer als afgerond'}</button>{error && <span className="platform-error inline-error" role="alert">{error}</span>}</div>;
}

export function ReviewForm({ conversationId }: { conversationId: string }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (loading) return;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conversationId, rating, body: body.trim() }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error === 'already_reviewed' ? 'Je hebt dit gesprek al beoordeeld.' : 'De beoordeling kon niet worden opgeslagen.'); return; }
      setSent(true);
    } catch { setError('Controleer je verbinding en probeer opnieuw.'); }
    finally { setLoading(false); }
  }
  if (sent) return <div className="review-success"><Check /><strong>Bedankt. Je beoordeling is gepubliceerd.</strong></div>;
  return <form className="review-form" onSubmit={submit}><div><strong>Hoe was je ervaring?</strong><div className="review-stars" role="radiogroup" aria-label="Beoordeling van 1 tot 5"><span>{[1,2,3,4,5].map((value) => <button key={value} type="button" className={value <= rating ? 'active' : ''} aria-label={`${value} sterren`} onClick={() => setRating(value)}><Star size={20} fill="currentColor" /></button>)}</span></div></div><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} placeholder="Optioneel: wat ging goed?" /><button className="primary compact-button" disabled={loading} type="submit">{loading ? 'Opslaan…' : 'Beoordeling plaatsen'}</button>{error && <p className="platform-error" role="alert">{error}</p>}</form>;
}
