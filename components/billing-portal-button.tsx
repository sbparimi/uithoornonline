'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  async function openPortal() {
    setLoading(true);
    const response = await fetch('/api/billing/portal', { method: 'POST' });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else setLoading(false);
  }
  return <button className="dashboard-side-link plain" onClick={openPortal} disabled={loading}>{loading ? <Loader2 className="spin" /> : null}Facturatie beheren <ArrowRight /></button>;
}
