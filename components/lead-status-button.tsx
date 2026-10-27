'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useDict } from './lang-context';
import { statusLabel } from '../lib/i18n/dictionaries';

export function LeadStatusButton({ leadId, status, nextStatus, label }: { leadId: string; status: string; nextStatus: string; label: string }) {
  const t = useDict();
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState(false);
  async function update() {
    setLoading(true);
    const response = await fetch('/api/provider/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, status: nextStatus }) });
    if (response.ok) setCurrent(nextStatus);
    setLoading(false);
  }
  if (current === nextStatus || ['converted','closed','declined'].includes(current)) return <span className="lead-status-complete"><Check aria-hidden="true" /> {statusLabel(t, current)}</span>;
  return <button className="lead-action" onClick={update} disabled={loading}>{loading ? <Loader2 className="spin" /> : null}{label}</button>;
}
