'use client';

import { useState } from 'react';
import { BadgeCheck, CheckCircle2, Loader2, Star } from 'lucide-react';
import { useLang } from './lang-context';
import { useSpamTrap } from './spam-trap';

// Verified review (review booster, docs/AI_REQUESTS.md): stars + optional text, sent with the signed review
// token of a completed job. Used on /beoordeling/<token> and inline on the customer's status page.
// Every review is written by the customer; nothing is generated.
export default function VerifiedReviewForm({ token, businessName, compact = false }: { token: string; businessName: string; compact?: boolean }) {
  const lang = useLang();
  const en = lang === 'en';
  const { fields: spamFields, trap } = useSpamTrap();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'already' | 'error'>('idle');
  const words = en ? ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'] : ['', 'Slecht', 'Matig', 'Goed', 'Heel goed', 'Uitstekend'];
  async function send() {
    if (!rating) return;
    setState('busy');
    try {
      const r = await fetch('/api/reviews/verified', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...spamFields, t: token, rating, body }) });
      if (r.ok) { setState('done'); return; }
      const d = await r.json().catch(() => ({}));
      setState(d.error === 'already_reviewed' ? 'already' : 'error');
    } catch { setState('error'); }
  }
  if (state === 'done' || state === 'already') return <div className="ui-won-box ui-review-done" role="status"><CheckCircle2 aria-hidden="true" />
    <h2>{state === 'done' ? (en ? 'Thank you for your review!' : 'Bedankt voor je beoordeling!') : (en ? 'You already reviewed this job' : 'Je hebt deze klus al beoordeeld')}</h2>
    <p>{en ? `It now shows on the page of ${businessName} with the "Verified job" label.` : `Hij staat nu op de pagina van ${businessName}, met het label "Geverifieerde klus".`}</p></div>;
  const shown = hover || rating;
  return <div className={`ui-review-form${compact ? ' ui-review-compact' : ''}`}>{trap}
    {!compact ? <p className="ui-verified"><BadgeCheck aria-hidden="true" /> {en ? 'Verified job: this review belongs to a real job via Uithoorn.online. Only your first name is shown.' : 'Geverifieerde klus: deze beoordeling hoort bij een echte klus via Uithoorn.online. Alleen je voornaam is zichtbaar.'}</p> : null}
    <div className="ui-stars-input" role="radiogroup" aria-label={en ? 'Rating' : 'Beoordeling'} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ${en ? (n === 1 ? 'star' : 'stars') : (n === 1 ? 'ster' : 'sterren')}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className={n <= shown ? 'on' : ''}><Star aria-hidden="true" fill={n <= shown ? 'currentColor' : 'none'} /></button>)}
      <span className="ui-stars-word">{words[shown]}</span>
    </div>
    <textarea rows={compact ? 2 : 4} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={en ? `What went well? What could ${businessName} do better? (optional)` : `Wat ging goed? Wat kan ${businessName} beter? (optioneel)`} aria-label={en ? 'Your review' : 'Je beoordeling'} />
    <button className="primary" type="button" disabled={!rating || state === 'busy'} onClick={send}>{state === 'busy' ? <Loader2 className="ui-spin" aria-hidden="true" /> : null} {en ? 'Post review' : 'Plaats beoordeling'}</button>
    {state === 'error' ? <p className="platform-error" role="alert">{en ? 'Something went wrong, try again.' : 'Er ging iets mis, probeer het opnieuw.'}</p> : null}
  </div>;
}
