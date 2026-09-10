'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export function PlanCheckout({ plan, label }: { plan: 'pro' | 'pro_plus'; label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startCheckout() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = `/login?next=/voor-bedrijven`; return; }
      if (response.status === 403) { window.location.href = `/signup/account?role=provider`; return; }
      if (!response.ok || !data.url) throw new Error(data.error || 'checkout_failed');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error && e.message === 'billing_not_configured' ? 'Online betaling wordt binnenkort geactiveerd.' : 'Starten van de betaling is niet gelukt.');
    } finally { setLoading(false); }
  }

  return <div className="plan-action"><button className="pricing-button" onClick={startCheckout} disabled={loading}>{loading ? <Loader2 className="spin" /> : null}{label}<ArrowRight /></button>{error ? <small className="pricing-error">{error}</small> : null}</div>;
}
