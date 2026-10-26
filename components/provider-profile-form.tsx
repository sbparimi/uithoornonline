'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useDict } from './lang-context';

type Business = { id: string; name: string; category: string; description: string; postcode: string | null; address: string | null; website: string | null; phone: string | null; verified: boolean };
// Values are stored as-is; labels are translated.
const categories = ['Klus & onderhoud', 'Schoonmaak', 'Elektricien & installatie', 'Tuin & buiten', 'Loodgieter', 'Transport & logistiek', 'Automotive', 'Kapper & beauty', 'Eten & catering', 'Professionele diensten'];

export default function ProviderProfileForm({ business }: { business: Business }) {
  const t = useDict();
  const p = t.provider;
  const options = categories.includes(business.category) ? categories : [business.category, ...categories];
  const [form, setForm] = useState({ name: business.name, category: business.category, description: business.description, postcode: business.postcode || '', address: business.address || '', website: business.website || '', phone: business.phone || '' });
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState('');
  const update = (key: keyof typeof form, value: string) => { setSaved(false); setForm((current) => ({ ...current, [key]: value })); };
  async function submit(event: FormEvent) {
    event.preventDefault(); if (saving) return; setSaving(true); setError(''); setSaved(false);
    try {
      const res = await fetch('/api/provider/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: form.name.trim(), category: form.category, description: form.description.trim(), postcode: form.postcode.trim().toUpperCase(), address: form.address.trim(), website: form.website.trim(), phone: form.phone.trim() }) });
      if (!res.ok) throw new Error('save_failed');
      setSaved(true);
    } catch { setError(p.saveError); } finally { setSaving(false); }
  }
  return <form className="platform-form provider-profile-edit" onSubmit={submit}>
    <label>{t.common.businessName}<input required value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
    <label>{t.common.category}<select value={form.category} onChange={(e) => update('category', e.target.value)}>{options.map((item) => <option key={item} value={item}>{p.profileCategories[item] ?? item}</option>)}</select></label>
    <label>{t.common.description}<textarea required minLength={20} value={form.description} onChange={(e) => update('description', e.target.value)} /></label>
    <label>{t.common.postcode}<input required value={form.postcode} onChange={(e) => update('postcode', e.target.value.toUpperCase())} /></label>
    <label>{p.address}<input value={form.address} onChange={(e) => update('address', e.target.value)} /></label>
    <label>{t.common.website}<input type="url" placeholder="https://" value={form.website} onChange={(e) => update('website', e.target.value)} /></label>
    <label>{t.common.phone}<input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label>
    {business.verified && <p className="verification-note"><Check aria-hidden="true" /> {p.verifiedNote}</p>}
    {error && <p className="platform-error" role="alert">{error}</p>}
    {saved && <p className="review-success" role="status"><Check aria-hidden="true" /> {p.saved}</p>}
    <button className="primary" disabled={saving} type="submit">{saving ? p.saving : p.save} <ArrowRight aria-hidden="true" /></button>
  </form>;
}
