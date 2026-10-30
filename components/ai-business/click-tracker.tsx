'use client';

import { useEffect } from 'react';

// Anonymous first-party counters for the "Jouw leads" report (no cookies, no IP stored: see
// app/api/analytics). Sends a page view for a business page, and a click event for any element with
// data-track="phone_click|website_click|whatsapp_click" data-biz="<business id>". On a business page,
// tel:, wa.me and outbound links inside [data-biz-page] are counted automatically.
function send(eventName: string, businessId: string | null) {
  try {
    const body = JSON.stringify({ eventName, businessId, metadata: { path: location.pathname.slice(0, 120) } });
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/analytics', blob)) fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch { /* never break the page for a counter */ }
}

export function ClickTracker({ viewBusinessId }: { viewBusinessId?: string }) {
  useEffect(() => {
    if (viewBusinessId) {
      const key = `uo_viewed_${viewBusinessId}`;
      // One view per business per browser tab session.
      try { if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); send('business_view', viewBusinessId); } } catch { send('business_view', viewBusinessId); }
    }
    const onClick = (ev: MouseEvent) => {
      const el = (ev.target as HTMLElement | null)?.closest('a, button') as HTMLElement | null;
      if (!el) return;
      const tagged = el.closest('[data-track]') as HTMLElement | null;
      if (tagged?.dataset.track) { send(tagged.dataset.track, tagged.dataset.biz ?? null); return; }
      const page = el.closest('[data-biz-page]') as HTMLElement | null;
      const href = el.getAttribute('href') || '';
      if (!page || !href) return;
      const biz = page.dataset.bizPage ?? null;
      if (href.startsWith('tel:')) send('phone_click', biz);
      else if (/wa\.me|whatsapp\.com/i.test(href)) send('whatsapp_click', biz);
      else if (/^https?:\/\//i.test(href) && !href.includes(location.host) && el.dataset.trackWebsite !== undefined) send('website_click', biz);
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [viewBusinessId]);
  return null;
}
