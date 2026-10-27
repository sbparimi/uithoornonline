'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { lp } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';

export function ProviderAcceptButton({ requestId }: { requestId: string }) {
  const lang = useLang();
  const p = useDict().provider;
  const network = useDict().common.network;
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function accept() {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/provider/requests/${requestId}/accept`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error === 'login_required' ? p.errLogin : data.error === 'request_not_available' ? p.errUnavailable : p.errAccept);
        return;
      }
      if (!data.conversationId) { setError(p.errNoConversation); return; }
      window.location.href = lp(lang, `/messages/${data.conversationId}`);
    } catch {
      setError(network);
    } finally {
      setLoading(false);
    }
  }
  return <>{error && <span className="platform-error inline-error" role="alert" aria-live="assertive">{error}</span>}<button className="primary compact-button" onClick={accept} disabled={loading}>{loading ? p.opening : p.respond} <ArrowRight aria-hidden="true" /></button></>;
}
