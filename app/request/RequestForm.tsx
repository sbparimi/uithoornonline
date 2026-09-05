'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';

export default function RequestForm() {
  const [category, setCategory] = useState('Klus & onderhoud');
  const [description, setDescription] = useState('');
  const [postcode, setPostcode] = useState('');
  const [preferredTiming, setPreferredTiming] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    const response = await fetch('/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category, description, postcode, preferredTiming }) });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (response.status === 401) { window.location.href = `/login?next=${encodeURIComponent('/request')}`; return; }
    if (!response.ok) { setError(data.error === 'invalid_request' ? 'Vul alle velden in. Beschrijf je aanvraag in minimaal 10 tekens.' : 'Je aanvraag kon niet worden verstuurd. Probeer het opnieuw.'); return; }
    setSuccess(data.id); setDescription(''); setPostcode(''); setPreferredTiming('');
  }

  if (success) return <div className="request-success"><Check /><div><span className="uo-kicker">Aanvraag ontvangen</span><h2>We hebben je aanvraag opgeslagen.</h2><p>Lokale aanbieders die bij je aanvraag passen kunnen reageren. Je aanvraagnummer is <strong>{success.slice(0, 8).toUpperCase()}</strong>.</p><a className="primary platform-button-link" href="/account">Bekijk mijn aanvragen <ArrowRight /></a></div></div>;

  return <form className="request-form" onSubmit={submit}>
    <label>Wat heb je nodig?<select value={category} onChange={e => setCategory(e.target.value)}><option>Klus & onderhoud</option><option>Schoonmaak</option><option>Elektricien & installatie</option><option>Tuin & buiten</option><option>Andere lokale dienst</option></select></label>
    <label>Waarmee kunnen we helpen?<textarea required value={description} onChange={e => setDescription(e.target.value)} placeholder="Bijvoorbeeld: Ik zoek iemand voor tuinonderhoud…" /></label>
    <label>Postcode<input required inputMode="text" value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="1421AB" /></label>
    <label>Wanneer heb je hulp nodig?<select required value={preferredTiming} onChange={e => setPreferredTiming(e.target.value)}><option value="" disabled>Selecteer een optie</option><option>Deze week</option><option>Deze maand</option><option>Later</option></select></label>
    {error && <p className="platform-error" role="alert">{error}</p>}
    <button className="primary" disabled={loading} type="submit">{loading ? 'Aanvraag versturen…' : 'Aanvraag starten'} <ArrowRight /></button>
    <small>Je aanvraag wordt alleen gedeeld met passende lokale aanbieders.</small>
  </form>;
}
