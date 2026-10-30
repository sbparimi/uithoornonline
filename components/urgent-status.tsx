'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Phone, Siren, Users } from 'lucide-react';
import { lp } from '../lib/i18n/config';
import { useLang } from './lang-context';
import WhatsAppFallback, { type WaContext } from './whatsapp-fallback';

// Live status of an intake request (polls /api/intake/status, which also advances spoed escalation).
type Status = { category: string; level: string | null; postcode: string; createdAt: string; stage: string; status: string; alerted: number; escalated: number; alertsSentAt: string | null;
  accepted: { name: string; phone: string | null; website: string | null; at: string } | null };

const T = {
  nl: { got: 'Je aanvraag is ontvangen', yours: 'Ontvangen om', alerted: (n: number) => n ? `${n} lokale ${n === 1 ? 'vakman' : 'vakmensen'} gewaarschuwd` : 'We zoeken een passende vakman', alerting: 'Vakmensen worden gewaarschuwd…',
    spoedWait: (m: number) => `Spoed: reageert er binnen ${m} minuten niemand, dan benaderen we 24/7 spoedbedrijven`, escalated: (n: number) => `${n} ${n === 1 ? 'bedrijf' : 'bedrijven'} met 24/7 spoedservice benaderd`,
    exhausted: 'Nog niemand gevonden: ons team is gewaarschuwd en zoekt persoonlijk verder. Bij direct gevaar: bel 112.', waiting: 'Wachten op een vakman die de klus aanneemt…',
    accepted: 'neemt je klus aan!', call: 'Bel', mail: 'Je krijgt ook een e-mail met deze gegevens. Houd deze pagina open of kom later terug via de link in je e-mail.', account: 'Naar je account', live: 'Live bijgewerkt',
    level: { spoed: '🚨 Spoed', today: 'Vandaag', week: 'Deze week', flexible: 'Flexibel' } as Record<string, string>, error: 'Status kon niet worden geladen.' },
  en: { got: 'We received your request', yours: 'Received at', alerted: (n: number) => n ? `${n} local ${n === 1 ? 'professional' : 'professionals'} alerted` : "We're finding a matching professional", alerting: 'Alerting professionals…',
    spoedWait: (m: number) => `Urgent: if nobody responds within ${m} minutes, we contact 24/7 emergency businesses`, escalated: (n: number) => `${n} ${n === 1 ? 'business' : 'businesses'} with 24/7 emergency service contacted`,
    exhausted: 'Nobody found yet: our team has been alerted and is looking personally. In immediate danger: call 112.', waiting: 'Waiting for a professional to accept…',
    accepted: 'is taking your job!', call: 'Call', mail: "You'll also get an email with these details. Keep this page open or come back via the link in your email.", account: 'Go to your account', live: 'Live updates',
    level: { spoed: '🚨 Urgent', today: 'Today', week: 'This week', flexible: 'Flexible' } as Record<string, string>, error: 'Could not load the status.' },
};

export default function UrgentStatus({ token, fresh = false, escalateMinutes = 10, whatsapp = null, labels = [], waCtx = {} }: {
  token: string; fresh?: boolean; escalateMinutes?: number; whatsapp?: string | null; labels?: [string, string][]; waCtx?: WaContext;
}) {
  const lang = useLang();
  const t = T[lang === 'en' ? 'en' : 'nl'];
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let stop = false; let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const r = await fetch(`/api/intake/status?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (!r.ok) throw new Error();
        const data: Status = await r.json();
        if (!stop) { setS(data); setErr(false); }
        if (!stop && !data.accepted) timer = setTimeout(load, data.level === 'spoed' ? 15000 : 30000);
      } catch { if (!stop) { setErr(true); timer = setTimeout(load, 30000); } }
    }
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [token]);

  const time = (v: string) => new Date(v).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  // WhatsApp fallback (docs/URGENT_HANDLING.md): shown when the status cannot be loaded or nobody was found.
  const wa = (reason: string) => {
    if (!whatsapp) return null;
    const ctx: WaContext = s ? {
      ...waCtx, category: labels.find(([k]) => k === s.category)?.[1] ?? waCtx.category ?? s.category,
      level: (t.level[s.level ?? 'flexible'] ?? s.level ?? '').replace('🚨 ', ''), postcode: s.postcode, createdAt: time(s.createdAt),
    } : waCtx;
    return <WhatsAppFallback number={whatsapp} lang={lang} ctx={ctx} reason={reason} kind="status" />;
  };
  if (!s) return <div className="ui-status">{err ? <><p className="platform-error" role="alert">{t.error}</p>{wa('status_error')}</> : <p><Loader2 className="ui-spin" aria-hidden="true" /> …</p>}</div>;
  const spoed = s.level === 'spoed';

  return <div className="ui-status" role="status">
    <div className="ui-status-head"><CheckCircle2 aria-hidden="true" /><div><h2>{t.got}</h2><p>{t.level[s.level ?? 'flexible'] ?? s.level} · {s.postcode} · {t.yours} {time(s.createdAt)}</p></div></div>
    <ol className="ui-steps">
      <li className="done"><CheckCircle2 aria-hidden="true" /><span>{t.got}</span></li>
      <li className={s.alertsSentAt || s.alerted ? 'done' : 'now'}>{s.alertsSentAt || s.alerted ? <Users aria-hidden="true" /> : <Loader2 className="ui-spin" aria-hidden="true" />}<span>{s.alertsSentAt || s.alerted ? t.alerted(s.alerted) : t.alerting}</span></li>
      {spoed && !s.accepted ? <li className={s.stage === 'waiting' ? 'now' : 'done'}><Siren aria-hidden="true" /><span>{s.stage === 'waiting' ? t.spoedWait(escalateMinutes) : s.stage === 'exhausted' ? t.exhausted : t.escalated(s.escalated)}</span></li> : null}
      {s.accepted
        ? <li className="done ui-won"><CheckCircle2 aria-hidden="true" /><span><strong>{s.accepted.name}</strong> {t.accepted}{s.accepted.phone ? <a className="primary platform-button-link ui-call" href={`tel:${s.accepted.phone}`}><Phone aria-hidden="true" /> {t.call} {s.accepted.phone}</a> : null}</span></li>
        : s.stage !== 'exhausted' ? <li className="now"><Clock aria-hidden="true" /><span>{t.waiting}</span></li> : null}
    </ol>
    {!s.accepted && s.stage === 'exhausted' ? wa('status_exhausted') : null}
    <p className="ui-muted">{fresh ? t.mail : t.live}</p>
    {fresh ? <a className="ui-ghost" href={lp(lang, '/account')}>{t.account}</a> : null}
  </div>;
}
