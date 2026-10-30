'use client';

import { useState } from 'react';

export function ReportToggle({ initial, lang }: { initial: boolean; lang: 'nl' | 'en' }) {
  const [on, setOn] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  async function change(v: boolean) {
    setOn(v); setState('saving');
    const res = await fetch('/api/provider/report-settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ report_email: v }) }).catch(() => null);
    setState(res?.ok ? 'saved' : 'error'); if (!res?.ok) setOn(!v);
  }
  const en = lang === 'en';
  return <label className="aib-check aib-report-toggle"><input type="checkbox" checked={on} onChange={(e) => change(e.target.checked)} disabled={state === 'saving'} /><span>{en ? 'Email me this summary once a month' : 'Stuur me dit overzicht één keer per maand per e-mail'}{state === 'saved' ? (en ? ' · saved' : ' · opgeslagen') : state === 'error' ? (en ? ' · could not save' : ' · opslaan mislukt') : ''}</span></label>;
}
