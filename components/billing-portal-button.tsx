'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useDict } from './lang-context';

export function BillingPortalButton() {
  const t = useDict();
  const [loading, setLoading] = useState(false);
  async function openPortal() {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (data.url) { window.location.href = data.url; return; }
    } catch {}
    setLoading(false);
  }
  return <button className="dashboard-side-link plain" onClick={openPortal} disabled={loading}>{loading ? <Loader2 className="spin" /> : null}{t.provider.billing} <ArrowRight aria-hidden="true" /></button>;
}
