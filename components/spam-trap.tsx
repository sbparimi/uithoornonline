'use client';

import { useEffect, useState } from 'react';

/**
 * Invisible anti-spam fields for public forms (see lib/security/spam.ts):
 * a honeypot input people never see, and the time the form was opened.
 * For fetch-based forms use `useSpamTrap()` and spread its values into the JSON body.
 */
export function useSpamTrap() {
  const [startedAt] = useState(() => Date.now());
  const [honey, setHoney] = useState('');
  const fields = { form_started_at: startedAt, company_website: honey };
  const trap = (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
      <label>Website (laat leeg)<input type="text" name="company_website" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} /></label>
    </div>
  );
  return { fields, trap };
}

export function SpamTrapFields() {
  const [startedAt, setStartedAt] = useState(0);
  useEffect(() => setStartedAt(Date.now()), []);
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
      <label>Website (laat leeg)<input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      <input type="hidden" name="form_started_at" value={startedAt || ''} readOnly />
    </div>
  );
}
