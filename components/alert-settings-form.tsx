'use client';

import { FormEvent, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { useLang } from './lang-context';

// Business job-alert preferences (/api/provider/alert-settings): channels, mobile for alerts,
// 24/7 spoed availability, quiet hours.
type S = { alert_email: boolean; alert_sms: boolean; alert_whatsapp: boolean; alert_phone: string | null; spoed_24_7: boolean; quiet_start: string | null; quiet_end: string | null };

export default function AlertSettingsForm() {
  const lang = useLang();
  const en = lang === 'en';
  const [s, setS] = useState<S | null>(null);
  const [channels, setChannels] = useState({ sms: false, whatsapp: false, voice: false });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch('/api/provider/alert-settings').then((r) => r.ok ? r.json() : null).then((d) => { if (d) { setS(d.settings); setChannels(d.channels); } }).catch(() => undefined); }, []);
  if (!s) return null;
  const set = (patch: Partial<S>) => { setS({ ...s, ...patch }); setMsg(''); };
  const soon = en ? ' (available soon)' : ' (binnenkort beschikbaar)';
  const errors: Record<string, string> = en
    ? { phone_required: 'Enter a mobile number for SMS/WhatsApp alerts or 24/7 emergency calls.', invalid_phone: 'That phone number is not valid.', quiet_hours_incomplete: 'Fill in both quiet-hours times, or neither.' }
    : { phone_required: 'Vul een mobiel nummer in voor sms/WhatsApp-meldingen of 24/7 spoedoproepen.', invalid_phone: 'Dat telefoonnummer klopt niet.', quiet_hours_incomplete: 'Vul beide tijden van de stille uren in, of geen van beide.' };
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/provider/alert-settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(errors[d.error] ?? (en ? 'Could not save.' : 'Opslaan lukte niet.')); return; }
      setS(d.settings); setMsg(en ? 'Saved.' : 'Opgeslagen.');
    } finally { setBusy(false); }
  }
  return <form className="provider-profile-form ui-alerts-form" onSubmit={save}>
    <h2><BellRing aria-hidden="true" /> {en ? 'Job alerts' : 'Klusmeldingen'}</h2>
    <p>{en ? 'How do you want to hear about new jobs? The first business to accept a job gets it.' : 'Hoe wil je nieuwe klussen ontvangen? Het eerste bedrijf dat een klus accepteert, krijgt hem.'}</p>
    <label className="ui-check"><input type="checkbox" checked={s.alert_email} onChange={(e) => set({ alert_email: e.target.checked })} /> <span>{en ? 'Email with one-tap accept link' : 'E-mail met accepteer-knop'}</span></label>
    <label className="ui-check"><input type="checkbox" checked={s.alert_sms} onChange={(e) => set({ alert_sms: e.target.checked })} /> <span>SMS{channels.sms ? '' : soon}</span></label>
    <label className="ui-check"><input type="checkbox" checked={s.alert_whatsapp} onChange={(e) => set({ alert_whatsapp: e.target.checked })} /> <span>WhatsApp{channels.whatsapp ? '' : soon}</span></label>
    <label>{en ? 'Mobile number for alerts' : 'Mobiel nummer voor meldingen'}<input type="tel" value={s.alert_phone ?? ''} maxLength={40} onChange={(e) => set({ alert_phone: e.target.value })} placeholder="06 12345678" /></label>
    <label className="ui-check ui-check-strong"><input type="checkbox" checked={s.spoed_24_7} onChange={(e) => set({ spoed_24_7: e.target.checked })} /> <span><strong>{en ? '24/7 emergency available' : '24/7 spoed beschikbaar'}</strong><small>{en ? 'If nobody accepts an urgent job within 10 minutes, we text and call you (also at night).' : 'Neemt niemand een spoedklus binnen 10 minuten aan, dan sturen we je een sms en bellen we je (ook ’s nachts).'}{channels.voice ? '' : soon}</small></span></label>
    <fieldset className="ui-quiet"><legend>{en ? 'Quiet hours (no SMS/WhatsApp, except 24/7 emergencies)' : 'Stille uren (geen sms/WhatsApp, behalve 24/7 spoed)'}</legend>
      <label>{en ? 'From' : 'Van'}<input type="time" value={s.quiet_start ?? ''} onChange={(e) => set({ quiet_start: e.target.value || null })} /></label>
      <label>{en ? 'Until' : 'Tot'}<input type="time" value={s.quiet_end ?? ''} onChange={(e) => set({ quiet_end: e.target.value || null })} /></label>
    </fieldset>
    {err ? <p className="platform-error" role="alert">{err}</p> : null}
    {msg ? <p className="platform-success" role="status">{msg}</p> : null}
    <button className="primary" type="submit" disabled={busy}>{en ? 'Save alerts' : 'Meldingen opslaan'}</button>
  </form>;
}
