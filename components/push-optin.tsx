"use client";

import { useEffect, useState } from 'react';
import '../app/growth.css';
import { Bell, BellOff, BellRing, Smartphone } from 'lucide-react';

// Free instant lead alerts for businesses: browser/PWA push notifications, no phone number needed.
// Shown on the business dashboard; hidden when push is not configured (publicKey empty).
type State = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'busy';

const T = {
  nl: {
    title: 'Nieuwe aanvragen direct op je telefoon',
    text: 'Zet meldingen aan en je ziet een nieuwe aanvraag binnen seconden, ook als je mail dicht is. Gratis, zonder telefoonnummer. Wie snel reageert, krijgt vaker de klus.',
    on: 'Meldingen aanzetten', off: 'Meldingen uitzetten', test: 'Stuur een testmelding',
    active: 'Meldingen staan aan op dit apparaat.', sent: 'Testmelding verstuurd. Zie je hem niet? Controleer de meldingen van je browser.',
    denied: 'Je browser blokkeert meldingen voor deze site. Zet ze aan via het slotje naast het webadres, en probeer het opnieuw.',
    unsupported: 'Deze browser ondersteunt geen meldingen. Gebruik Chrome, Edge, Firefox of Safari (op Mac of iPhone).',
    ios: 'Op iPhone: tik op Deel ⬆︎ en kies "Zet op beginscherm". Open Uithoorn.online daarna vanaf je beginscherm en zet hier meldingen aan.',
    error: 'Dat lukte niet. Probeer het nog eens.',
  },
  en: {
    title: 'New requests straight to your phone',
    text: 'Switch on notifications and you see a new request within seconds, even when your email is closed. Free, no phone number needed. Businesses that respond fast win more jobs.',
    on: 'Turn on notifications', off: 'Turn off notifications', test: 'Send a test notification',
    active: 'Notifications are on for this device.', sent: 'Test notification sent. Not seeing it? Check your browser’s notification settings.',
    denied: 'Your browser blocks notifications for this site. Allow them via the padlock next to the address, then try again.',
    unsupported: 'This browser does not support notifications. Use Chrome, Edge, Firefox or Safari (on Mac or iPhone).',
    ios: 'On iPhone: tap Share ⬆︎ and choose "Add to Home Screen". Then open Uithoorn.online from your home screen and switch notifications on here.',
    error: 'That did not work. Please try again.',
  },
};

function keyBytes(b64: string) {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushOptIn({ lang, publicKey }: { lang: 'nl' | 'en'; publicKey: string }) {
  const t = T[lang];
  const [state, setState] = useState<State>('loading');
  const [note, setNote] = useState('');

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { setState(ios && !standalone ? 'ios-install' : 'unsupported'); return; }
      if (Notification.permission === 'denied') { setState('denied'); return; }
      const reg = await navigator.serviceWorker.getRegistration('/api/push/');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    setState('busy'); setNote('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return; }
      const reg = await navigator.serviceWorker.register('/api/push/sw', { scope: '/api/push/' });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!res.ok) throw new Error(String(res.status));
      setState('on');
    } catch { setState('off'); setNote(t.error); }
  }

  async function disable() {
    setState('busy'); setNote('');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/api/push/');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
        await sub.unsubscribe();
      }
      setState('off');
    } catch { setState('on'); setNote(t.error); }
  }

  async function test() {
    setNote('');
    const res = await fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang }) }).catch(() => null);
    setNote(res && res.ok ? t.sent : t.error);
  }

  if (!publicKey) return null;
  return (
    <section className="push-optin" aria-live="polite">
      <span className="push-optin-icon" aria-hidden="true">{state === 'on' ? <BellRing /> : state === 'ios-install' ? <Smartphone /> : <Bell />}</span>
      <div className="push-optin-body">
        <h2>{t.title}</h2>
        <p>{t.text}</p>
        {state === 'ios-install' && <p className="push-optin-hint">{t.ios}</p>}
        {state === 'unsupported' && <p className="push-optin-hint">{t.unsupported}</p>}
        {state === 'denied' && <p className="push-optin-hint">{t.denied}</p>}
        {state === 'on' && <p className="push-optin-ok">{t.active}</p>}
        <div className="push-optin-actions">
          {(state === 'off' || state === 'busy' || state === 'loading') && <button type="button" className="push-optin-btn primary" onClick={enable} disabled={state !== 'off'}><Bell aria-hidden="true" /> {t.on}</button>}
          {state === 'on' && <><button type="button" className="push-optin-btn primary" onClick={test}><BellRing aria-hidden="true" /> {t.test}</button><button type="button" className="push-optin-btn" onClick={disable}><BellOff aria-hidden="true" /> {t.off}</button></>}
        </div>
        {note && <p className="push-optin-note">{note}</p>}
      </div>
    </section>
  );
}
