'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';

const categories = ['Home improvement & renovation','Garden & outdoor','Plumber','Handyman','Cleaning & household','Transport & logistics','Property services','Automotive','Family & personal','Events & occasions','Food & catering','Professional services'];
const timingOptions = ['Today', 'This week', 'Next week', 'This month', 'Flexible'];
const urgencyOptions = ['As soon as possible', 'Within a week', 'Within a month', 'No urgency'];

export default function RequestForm({ initialCategory = '' }: { initialCategory?: string }) {
  const normalizedCategory = categories.find((item) => item.toLowerCase() === initialCategory.toLowerCase()) || categories.find((item) => item.toLowerCase().includes(initialCategory.toLowerCase())) || categories[0];
  const [category, setCategory] = useState(normalizedCategory);
  const [description, setDescription] = useState('');
  const [postcode, setPostcode] = useState('');
  const [preferredTiming, setPreferredTiming] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [urgency, setUrgency] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch('/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category, description, postcode, preferredTiming, budgetMin, budgetMax, urgency }) });
      const data = await response.json().catch(() => ({}));
      setLoading(false);
      if (response.status === 401) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`; return; }
      if (!response.ok) { setError(data.error === 'invalid_request' ? 'Vul alle verplichte velden in en controleer je budget.' : 'Je aanvraag kon niet worden verstuurd. Probeer het opnieuw.'); return; }
      setSuccess(data.id); setDescription(''); setPostcode(''); setPreferredTiming(''); setBudgetMin(''); setBudgetMax(''); setUrgency('');
    } catch { setLoading(false); setError('Er ging iets mis. Controleer je verbinding en probeer opnieuw.'); }
  }

  return success ? <div className="request-success"><Check /><div><span className="uo-kicker">Aanvraag ontvangen</span><h2>We gaan dit lokaal regelen.</h2><p>Je aanvraag staat klaar voor passende, geverifieerde lokale aanbieders. Je aanvraagnummer is <strong>{success.slice(0, 8).toUpperCase()}</strong>.</p><a className="primary platform-button-link" href="/account">Bekijk mijn aanvragen <ArrowRight /></a></div></div> : <form className="request-form" onSubmit={submit}>
    <label>Wat moet er geregeld worden?<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
    <label>Beschrijf de taak<textarea required minLength={15} value={description} onChange={e => setDescription(e.target.value)} placeholder="Bijvoorbeeld: Mijn tuin is sterk overwoekerd. Ik wil deze laten renoveren met nieuwe bestrating en beplanting." /></label>
    <label>Postcode<input required inputMode="text" value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="1421 AB" /></label>
    <label>Wanneer moet het gebeuren?<select required value={preferredTiming} onChange={e => setPreferredTiming(e.target.value)}><option value="" disabled>Selecteer een optie</option>{timingOptions.map(item => <option key={item}>{item}</option>)}</select></label>
    <div className="request-budget-fields"><label>Budget vanaf (€)<input type="number" min="0" step="1" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="100" /></label><label>Budget tot (€)<input type="number" min="0" step="1" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="500" /></label></div>
    <label>Hoe dringend is de aanvraag?<select required value={urgency} onChange={e => setUrgency(e.target.value)}><option value="" disabled>Selecteer een optie</option>{urgencyOptions.map(item => <option key={item}>{item}</option>)}</select></label>
    {error && <p className="platform-error" role="alert">{error}</p>}
    <button className="primary" disabled={loading} type="submit">{loading ? 'Aanvraag versturen…' : 'Laat Uithoorn.online dit regelen'} <ArrowRight /></button>
    <small>We delen je aanvraag alleen met relevante, geverifieerde lokale aanbieders. Er wordt in deze fase nog geen task-completion fee in rekening gebracht.</small>
  </form>;
}
