'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export function ProviderAcceptButton({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function accept() {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/provider/requests/${requestId}/accept`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error === 'login_required' ? 'Log opnieuw in om te reageren.' : data.error === 'request_not_available' ? 'Deze aanvraag is niet meer beschikbaar.' : 'Kon de aanvraag niet accepteren. Probeer het opnieuw.');
        return;
      }
      if (!data.conversationId) { setError('De aanvraag is geaccepteerd, maar het gesprek kon niet worden geopend. Ga naar je dashboard.'); return; }
      window.location.href = `/messages/${data.conversationId}`;
    } catch {
      setError('Er ging iets mis met de verbinding. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }
  return <>{error && <span className="platform-error inline-error" role="alert" aria-live="assertive">{error}</span>}<button className="primary compact-button" onClick={accept} disabled={loading}>{loading ? 'Openen…' : 'Reageren'} <ArrowRight /></button></>;
}
