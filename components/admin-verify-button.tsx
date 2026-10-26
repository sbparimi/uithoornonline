'use client';

import { useState } from 'react';
import { useDict } from './lang-context';

export function AdminVerifyButton({ businessId }: { businessId: string }) {
  const a = useDict().admin;
  const [loading, setLoading] = useState(false);
  async function verify() {
    setLoading(true);
    const response = await fetch(`/api/admin/businesses/${businessId}/verify`, { method: 'POST' });
    setLoading(false);
    if (response.ok) window.location.reload();
  }
  return <button className="compact-button" onClick={verify} disabled={loading}>{loading ? a.busy : a.verify}</button>;
}
