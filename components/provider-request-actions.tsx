'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export function ProviderAcceptButton({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function accept() {
    setLoading(true); setError('');
    const response = await fetch(`/api/provider/requests/${requestId}/accept`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError('Kon de aanvraag niet accepteren.'); return; }
    window.location.href = `/messages/${data.conversationId}`;
  }
  return <>{error && <span className="platform-error inline-error">{error}</span>}<button className="primary compact-button" onClick={accept} disabled={loading}>{loading ? 'Openen…' : 'Reageren'} <ArrowRight /></button></>;
}
