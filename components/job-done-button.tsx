'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useLang } from './lang-context';

// "Klus afgerond" for the business that has the job (classic first-to-accept jobs). Marks the job done;
// the customer then gets one verified review request (docs/AI_REQUESTS.md).
export default function JobDoneButton({ token, done = false }: { token: string; done?: boolean }) {
  const lang = useLang();
  const en = lang === 'en';
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>(done ? 'done' : 'idle');
  async function go() {
    setState('busy');
    try {
      const r = await fetch('/api/jobs/done', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: token }) });
      setState(r.ok ? 'done' : 'error');
    } catch { setState('error'); }
  }
  if (state === 'done') return <p className="ui-muted"><CheckCircle2 aria-hidden="true" className="ui-inline-icon" /> {en ? 'Marked as done. We asked the customer for a review.' : 'Gemarkeerd als klaar. We hebben de klant om een beoordeling gevraagd.'}</p>;
  return <div className="ui-after ui-done-ask"><span>{en ? 'Finished the job?' : 'Klus afgerond?'}</span>
    <button type="button" className="ui-ghost" disabled={state === 'busy'} onClick={go}>{state === 'busy' ? <Loader2 className="ui-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} {en ? 'Mark as done' : 'Markeer als klaar'}</button>
    {state === 'error' ? <p className="platform-error" role="alert">{en ? 'Something went wrong, try again.' : 'Er ging iets mis, probeer het opnieuw.'}</p> : null}
  </div>;
}
