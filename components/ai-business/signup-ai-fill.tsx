'use client';

import { useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';

export type SignupFill = { name: string | null; category: string | null; description: string | null; website: string | null; postcode: string | null; publicEmail: string | null; phone: string | null };
const DRAFT_KEY = 'uo_ai_profile_draft';

// Business signup: "Heb je een website? Laat AI je aanmelding invullen." Fills the signup fields from the
// business's own website and keeps the full draft (EN text, services, hours, FAQs) in this browser tab,
// so the profile page can offer it right after signup. Nothing is saved or published here.
export function SignupAiFill({ lang, onFill }: { lang: 'nl' | 'en'; onFill: (d: SignupFill) => void }) {
  const en = lang === 'en';
  const L = (nl: string, e: string) => (en ? e : nl);
  const [site, setSite] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  async function run() {
    if (!site.trim() || state === 'busy') return;
    setState('busy'); setMsg('');
    try {
      const res = await fetch('/api/ai/profile-draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ website: site, lang }), signal: AbortSignal.timeout(70000) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState('error');
        setMsg(data.error === 'rate_limited' ? L('Te vaak geprobeerd. Vul het formulier zelf in, of probeer het over een uur opnieuw.', 'Tried too often. Fill in the form yourself, or try again in an hour.') : L('We konden die website niet lezen. Klopt het adres? Je kunt het formulier ook zelf invullen.', "We couldn't read that website. Is the address right? You can also fill in the form yourself."));
        return;
      }
      const d = data.draft;
      try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* private mode: fine */ }
      onFill({ name: d.name, category: d.category, description: d.description_nl, website: d.website, postcode: d.postcode, publicEmail: d.public_email, phone: d.phone });
      setState('done');
      setMsg(L('Ingevuld met AI. Controleer de velden hieronder en pas aan waar nodig. Openingstijden, diensten en veelgestelde vragen vul je straks aan op je profielpagina.', 'Filled in with AI. Check the fields below and edit where needed. You add opening hours, services and FAQs on your profile page next.'));
    } catch { setState('error'); setMsg(L('Dat duurde te lang. Vul het formulier zelf in of probeer het opnieuw.', 'That took too long. Fill in the form yourself or try again.')); }
  }
  return (
    <div className="aib-signup-fill">
      <p className="aib-signup-title"><Sparkles aria-hidden="true" /> <strong>{L('Heb je een website? Laat AI je aanmelding invullen.', 'Have a website? Let AI fill in your sign-up.')}</strong></p>
      <div className="aib-signup-row">
        <input type="text" inputMode="url" aria-label={L('Je website', 'Your website')} placeholder="www.jouwbedrijf.nl" value={site} onChange={(e) => setSite(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } }} />
        <button type="button" className="aib-btn aib-btn-primary" onClick={run} disabled={state === 'busy' || !site.trim()}>{state === 'busy' ? <><Loader2 aria-hidden="true" className="aib-spin" /> {L('Bezig…', 'Working…')}</> : L('Invullen met AI', 'Fill in with AI')}</button>
      </div>
      {msg && <p className={state === 'error' ? 'aib-error' : 'aib-ok'} role={state === 'error' ? 'alert' : 'status'}>{state === 'done' && <Check aria-hidden="true" />} {msg}</p>}
    </div>
  );
}
