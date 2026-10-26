'use client';

import { FormEvent, useState } from 'react';
import { Check, Download, Trash2 } from 'lucide-react';
import { lp } from '../lib/i18n/config';
import { getBackendDict } from '../lib/i18n/backend';
import { useDict, useLang } from './lang-context';

type Props = { email: string; fullName: string; phone: string | null; locale: 'nl' | 'en'; hasPassword: boolean; viaLink: boolean; isAdmin: boolean };

export function AccountSettings({ email, fullName, phone, locale, hasPassword, viaLink, isAdmin }: Props) {
  const lang = useLang();
  const t = useDict();
  const b = getBackendDict(lang);
  const s = b.settings;
  const [profile, setProfile] = useState({ fullName, phone: phone ?? '', locale });
  const [profileMsg, setProfileMsg] = useState(''); const [pw, setPw] = useState({ current: '', next: '' }); const [pwMsg, setPwMsg] = useState(''); const [pwErr, setPwErr] = useState('');
  const [confirm, setConfirm] = useState(''); const [delErr, setDelErr] = useState(''); const [busy, setBusy] = useState('');

  async function saveProfile(e: FormEvent) {
    e.preventDefault(); setBusy('profile'); setProfileMsg('');
    const res = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(profile) }).catch(() => null);
    setProfileMsg(res?.ok ? s.saved : s.error); setBusy('');
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault(); setBusy('pw'); setPwMsg(''); setPwErr('');
    const res = await fetch('/api/account/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) }).catch(() => null);
    const data = await res?.json().catch(() => ({})) ?? {};
    if (res?.ok) { setPwMsg(s.passwordChanged); setPw({ current: '', next: '' }); }
    else setPwErr(data.error === 'invalid_current_password' ? s.wrongCurrent : data.error === 'password_too_short' ? b.auth.weakPassword : s.error);
    setBusy('');
  }
  async function deleteAccount(e: FormEvent) {
    e.preventDefault(); setDelErr('');
    if (confirm.trim().toLowerCase() !== email.toLowerCase()) { setDelErr(s.deleteMismatch); return; }
    setBusy('delete');
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmEmail: confirm.trim() }) }).catch(() => null);
    if (res?.ok) { window.location.href = `${lp(lang, '/')}?deleted=1`; return; }
    setDelErr(s.error); setBusy('');
  }

  return <div className="settings-stack">
    <section className="dashboard-section">
      <div className="dashboard-section-head"><h2>{s.profile}</h2></div>
      <form className="platform-form" onSubmit={saveProfile}>
        <label>{t.common.email}<input type="email" value={email} disabled readOnly /></label>
        <label>{t.common.name}<input required minLength={2} maxLength={120} value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></label>
        <label>{t.common.phone}<input type="tel" maxLength={40} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
        <label>{s.language}<select value={profile.locale} onChange={(e) => setProfile({ ...profile, locale: e.target.value as 'nl' | 'en' })}><option value="nl">Nederlands</option><option value="en">English</option></select></label>
        {profileMsg && <p className={profileMsg === s.saved ? 'review-success' : 'platform-error'} role="status">{profileMsg === s.saved && <Check aria-hidden="true" />} {profileMsg}</p>}
        <button className="primary" type="submit" disabled={busy === 'profile'}>{s.save}</button>
      </form>
    </section>

    <section className="dashboard-section">
      <div className="dashboard-section-head"><h2>{s.passwordTitle}</h2></div>
      <form className="platform-form" onSubmit={changePassword}>
        {hasPassword && !viaLink && <label>{s.current}<input type="password" required autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>}
        <label>{s.newPassword}<input type="password" required minLength={10} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /><small>{b.auth.passwordHint}</small></label>
        {pwMsg && <p className="review-success" role="status"><Check aria-hidden="true" /> {pwMsg}</p>}
        {pwErr && <p className="platform-error" role="alert">{pwErr}</p>}
        <button className="primary" type="submit" disabled={busy === 'pw'}>{s.changePassword}</button>
      </form>
    </section>

    <section className="dashboard-section">
      <div className="dashboard-section-head"><h2>{s.exportTitle}</h2><Download aria-hidden="true" /></div>
      <p>{s.exportText}</p>
      <a className="primary platform-button-link" href="/api/account/export" download><Download aria-hidden="true" /> {s.exportButton}</a>
    </section>

    {!isAdmin && <section className="dashboard-section danger-zone">
      <div className="dashboard-section-head"><h2>{s.deleteTitle}</h2><Trash2 aria-hidden="true" /></div>
      <p>{s.deleteText}</p>
      <form className="platform-form" onSubmit={deleteAccount}>
        <label>{s.deleteConfirm}<input type="email" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={email} autoComplete="off" /></label>
        {delErr && <p className="platform-error" role="alert">{delErr}</p>}
        <button className="danger-button" type="submit" disabled={busy === 'delete'}><Trash2 aria-hidden="true" /> {s.deleteButton}</button>
      </form>
    </section>}
    <p className="platform-note">{s.retention} <a href={lp(lang, '/privacy')}>{b.auth.privacy}</a></p>
    <form method="post" action="/api/auth/signout"><button className="platform-secondary-link link-button" type="submit">{b.auth.logout}</button></form>
  </div>;
}
