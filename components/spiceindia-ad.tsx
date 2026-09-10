'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

const DISMISS_KEY = 'spiceindia-exit-ad-dismissed';

export function SpiceIndiaAd() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
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

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') show();
    };

    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="spiceindia-ad-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) dismiss();
    }}>
      <aside className="spiceindia-ad" role="dialog" aria-modal="true" aria-labelledby="spiceindia-ad-title">
        <button className="spiceindia-ad-close" type="button" aria-label="Sluiten" onClick={dismiss}>
          <X />
        </button>
        <div className="spiceindia-ad-pulse" aria-hidden="true" />
        <div className="spiceindia-ad-content">
          <span className="spiceindia-ad-kicker">EEN LOKALE TIP UIT UITHOORN</span>
          <h2 id="spiceindia-ad-title">SpiceIndia</h2>
          <p>Vers Indiaas eten, thuisgemaakt in Uithoorn.</p>
          <div className="spiceindia-ad-actions">
            <a href="https://www.spiceindia.nl/" target="_blank" rel="noreferrer">Bekijk SpiceIndia.nl</a>
            <a className="spiceindia-ad-whatsapp" href="https://wa.me/31645480446" target="_blank" rel="noreferrer">
              <MessageCircle /> WhatsApp
            </a>
          </div>
        </div>
        <span className="spiceindia-ad-badge">SpiceIndia.nl</span>
      </aside>
    </div>
  );
}
