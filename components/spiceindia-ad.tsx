'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import { useDict, useLang } from './lang-context';

const DISMISS_KEY = 'spiceindia-exit-ad-dismissed';
// The ad is for public browsing pages only: never in the admin console, account/business dashboards,
// conversations, sign-in/sign-up flows or the legal pages.
const NO_AD = /^\/(en\/)?(admin|account|provider|messages|login|signup|forgot-password|reset-password|privacy|voorwaarden|cookies|contact|request)(\/|$)/;

export function SpiceIndiaAd() {
  const t = useDict().ad;
  const lang = useLang();
  const pathname = usePathname() || '/';
  const allowed = !NO_AD.test(pathname);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!allowed) return;
    const dismissed = window.sessionStorage.getItem(DISMISS_KEY) === '1';
    if (dismissed) return;

    let shown = false;
    const show = () => {
      if (shown || window.sessionStorage.getItem(DISMISS_KEY) === '1') return;
      shown = true;
      setOpen(true);
    };

    const onMouseLeave = (event: MouseEvent) => {
      if (event.clientY <= 8) show();
    };

    // Exit intent on desktop only (pointer leaves through the top of the window).
    document.addEventListener('mouseleave', onMouseLeave);
    return () => document.removeEventListener('mouseleave', onMouseLeave);
  }, [allowed]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  if (!open || !allowed) return null;

  return (
    <div className="spiceindia-ad-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) dismiss();
    }}>
      <aside className="spiceindia-ad" role="dialog" aria-modal="true" aria-labelledby="spiceindia-ad-title">
        <button ref={closeRef} className="spiceindia-ad-close" type="button" aria-label={t.close} onClick={dismiss}>
          <X aria-hidden="true" />
        </button>
        <div className="spiceindia-ad-pulse" aria-hidden="true" />
        <div className="spiceindia-ad-content">
          <span className="spiceindia-ad-kicker">{lang === 'en' ? 'Ad' : 'Advertentie'} · {t.kicker}</span>
          <h2 id="spiceindia-ad-title">SpiceIndia</h2>
          <p>{t.text}</p>
          <div className="spiceindia-ad-actions">
            <a href="https://www.spiceindia.nl/" target="_blank" rel="noopener noreferrer">{t.visit}</a>
            <a className="spiceindia-ad-whatsapp" href="https://wa.me/31645480446" target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" /> WhatsApp
            </a>
          </div>
        </div>
        <span className="spiceindia-ad-badge">SpiceIndia.nl</span>
      </aside>
    </div>
  );
}
