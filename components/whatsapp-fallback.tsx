'use client';

import { MessageCircle } from 'lucide-react';

// "Lukt het niet? Stuur ons een WhatsApp" — fallback for the help assistant (docs/URGENT_HANDLING.md).
// Opens wa.me (WhatsApp app on phones, WhatsApp Web on desktop) with what the resident already typed,
// so nothing is lost. Only rendered when WHATSAPP_CONTACT_NUMBER is set on the server.

export type WaContext = {
  problem?: string; category?: string; level?: string; postcode?: string;
  name?: string; phone?: string; email?: string; createdAt?: string;
};

const COPY = {
  nl: {
    button: 'Lukt het niet? Stuur ons een WhatsApp', hint: 'Wat je al hebt ingevuld, staat er al in.',
    introIntake: 'Hallo Uithoorn.online, het lukt me niet om mijn hulpvraag via de website te versturen.',
    introStatus: 'Hallo Uithoorn.online, ik heb via de website een hulpvraag gedaan, maar die lijkt niet goed door te komen. Kunnen jullie helpen?',
    problem: 'Probleem', category: 'Categorie', level: 'Urgentie', postcode: 'Postcode', name: 'Naam', phone: 'Telefoon', email: 'E-mail', createdAt: 'Geplaatst',
  },
  en: {
    button: 'Not working? Message us on WhatsApp', hint: "What you've typed so far is already filled in.",
    introIntake: "Hi Uithoorn.online, I couldn't send my request for help through the website.",
    introStatus: "Hi Uithoorn.online, I posted a request for help on the website but it doesn't seem to be going through. Can you help?",
    problem: 'Problem', category: 'Category', level: 'Urgency', postcode: 'Postcode', name: 'Name', phone: 'Phone', email: 'Email', createdAt: 'Posted',
  },
};

export function whatsappText(lang: string, ctx: WaContext, kind: 'intake' | 'status' = 'intake') {
  const c = COPY[lang === 'en' ? 'en' : 'nl'];
  const clip = (v: string | undefined, n: number) => { const s = (v ?? '').trim().replace(/\s+\n/g, '\n'); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
  const lines: string[] = [kind === 'status' ? c.introStatus : c.introIntake, ''];
  const add = (k: keyof WaContext, max = 120) => { const v = clip(ctx[k], max); if (v) lines.push(`${c[k]}: ${v}`); };
  add('problem', 900); add('category'); add('level'); add('postcode', 12); add('name'); add('phone', 40); add('email'); add('createdAt', 40);
  return lines.join('\n').trim();
}

export function whatsappHref(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function logClick(reason: string, lang: string) {
  try {
    void fetch('/api/intake/whatsapp', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason, lang }) }).catch(() => undefined);
  } catch { /* logging must never block the resident */ }
}

export default function WhatsAppFallback({ number, lang, ctx, reason, kind = 'intake', variant = 'button' }: {
  number: string; lang: string; ctx: WaContext; reason: string; kind?: 'intake' | 'status'; variant?: 'button' | 'link';
}) {
  const c = COPY[lang === 'en' ? 'en' : 'nl'];
  const href = whatsappHref(number, whatsappText(lang, ctx, kind));
  if (variant === 'link') {
    return <p className="ui-wa-small"><a href={href} target="_blank" rel="noopener noreferrer" onClick={() => logClick(reason, lang)} data-wa-reason={reason}>
      <MessageCircle aria-hidden="true" /> {c.button}</a></p>;
  }
  return <div className="ui-wa">
    <a className="ui-wa-btn" href={href} target="_blank" rel="noopener noreferrer" onClick={() => logClick(reason, lang)} data-wa-reason={reason}>
      <MessageCircle aria-hidden="true" /> {c.button}</a>
    <small>{c.hint}</small>
  </div>;
}
