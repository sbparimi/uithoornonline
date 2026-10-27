import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppHeader } from '../../../components/app-header';
import { getCurrentUser } from '../../../lib/auth/session';
import * as admin from '../../../lib/data/admin';
import { dateLocale, isLocale, lp, type Locale } from '../../../lib/i18n/config';
import { getBackendDict } from '../../../lib/i18n/backend';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const TABS = ['stats', 'businesses', 'requests', 'reviews', 'users', 'leads', 'inbox'] as const;
type Tab = (typeof TABS)[number];

function Action({ action, id, label, extra, danger }: { action: string; id: string; label: string; extra?: Record<string, string>; danger?: boolean }) {
  return <form method="post" action="/api/admin" className="admin-inline-form">
    <input type="hidden" name="action" value={action} /><input type="hidden" name="id" value={id} />
    {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    <button type="submit" className={danger ? 'admin-btn danger' : 'admin-btn'}>{label}</button>
  </form>;
}

export default async function AdminPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { lang: raw } = await params;
  const sp = await searchParams;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const a = getBackendDict(lang).admin;
  const user = await getCurrentUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, '/admin'))}`);
  if (user.role !== 'admin') redirect(lp(lang, '/'));
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? sp.tab as Tab : 'stats';
  const date = (v: string | null) => (v ? new Date(v).toLocaleString(dateLocale(lang), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
  const label: Record<Tab, string> = { stats: a.stats, businesses: a.businesses, requests: a.requests, reviews: a.reviews, users: a.users, leads: a.leads, inbox: a.inbox };
  const href = (t: Tab) => `${lp(lang, '/admin')}?tab=${t}`;

  let body: React.ReactNode = null;
  if (tab === 'stats') {
    const s = await admin.adminStats(user);
    body = <div className="monetization-metrics admin-stats">{Object.entries(s ?? {}).map(([k, v]) => <div key={k}><span>{k.replace(/_/g, ' ')}</span><strong>{v}</strong></div>)}</div>;
  } else if (tab === 'businesses') {
    const rows = await admin.adminListBusinesses(user);
    body = rows.length ? rows.map((b) => <article className="admin-row" key={b.id}>
      <div className="admin-row-main"><span className={`lead-pill lead-${b.moderation_status}`}>{b.moderation_status}</span><h3>{b.name}</h3><p>{b.category} · {b.postcode || '–'} · {b.phone || '–'} · {b.owner_email || '(geen eigenaar / no owner)'} · {a.plan}: {b.plan_key} · leads {b.leads_month} · {date(b.created_at)}</p></div>
      <div className="admin-row-actions">
        {b.moderation_status !== 'approved' && <Action action="business.approve" id={b.id} label={a.approve} />}
        {b.moderation_status !== 'rejected' && <Action action="business.reject" id={b.id} label={a.reject} danger />}
        <Action action="business.flags" id={b.id} label={`${a.verified}: ${b.verified ? '✓' : '✗'}`} extra={{ verified: String(!b.verified) }} />
        <Action action="business.flags" id={b.id} label={`${a.featured}: ${b.featured ? '✓' : '✗'}`} extra={{ featured: String(!b.featured) }} />
        <Action action="business.flags" id={b.id} label={`${a.active}: ${b.active ? '✓' : '✗'}`} extra={{ active: String(!b.active) }} />
        <form method="post" action="/api/admin" className="admin-inline-form"><input type="hidden" name="action" value="business.plan" /><input type="hidden" name="id" value={b.id} /><select name="plan" defaultValue={b.plan_key} aria-label={a.plan}><option value="free">Gratis</option><option value="pro">Pro</option><option value="pro_plus">Pro+</option></select><input name="note" placeholder="notitie / note" maxLength={200} /><button className="admin-btn" type="submit">{a.save}</button></form>
        <form method="post" action="/api/admin" className="admin-inline-form"><input type="hidden" name="action" value="business.owner" /><input type="hidden" name="id" value={b.id} /><input name="email" type="email" placeholder={a.owner} defaultValue={b.owner_email ?? ''} /><button className="admin-btn" type="submit">{a.save}</button></form>
      </div></article>) : <p>{a.none}</p>;
  } else if (tab === 'requests') {
    const rows = await admin.adminListRequests(user);
    body = rows.length ? rows.map((r) => <article className={`admin-row ${r.hidden ? 'is-hidden' : ''}`} key={r.id}>
      <div className="admin-row-main"><span className="lead-pill">{r.status}</span><h3>{r.category} · {r.postcode}</h3><p>{r.description}</p><p>{r.customer_email} · leads {r.leads} · {date(r.created_at)}</p></div>
      <div className="admin-row-actions">{r.hidden ? <Action action="request.unhide" id={r.id} label={a.unhide} /> : <Action action="request.hide" id={r.id} label={a.hide} danger />}</div></article>) : <p>{a.none}</p>;
  } else if (tab === 'reviews') {
    const rows = await admin.adminListReviews(user);
    body = rows.length ? rows.map((r) => <article className={`admin-row ${r.hidden ? 'is-hidden' : ''}`} key={r.id}>
      <div className="admin-row-main"><span className="lead-pill">{'★'.repeat(r.rating)}</span><h3>{r.business_name}</h3><p>{r.body || '–'}</p><p>{r.customer_email} · {date(r.created_at)}</p></div>
      <div className="admin-row-actions">{r.hidden ? <Action action="review.unhide" id={r.id} label={a.unhide} /> : <Action action="review.hide" id={r.id} label={a.hide} danger />}</div></article>) : <p>{a.none}</p>;
  } else if (tab === 'users') {
    const rows = await admin.adminListUsers(user, sp.q ?? '');
    body = <>
      <form method="get" className="admin-inline-form"><input type="hidden" name="tab" value="users" /><input name="q" defaultValue={sp.q ?? ''} placeholder="e-mail / naam" /><button className="admin-btn" type="submit">Zoek</button></form>
      {rows.map((u) => <article className={`admin-row ${u.disabled_at ? 'is-hidden' : ''}`} key={u.id}>
        <div className="admin-row-main"><span className="lead-pill">{u.role}</span><h3>{u.full_name || '–'}</h3><p>{u.email} · {u.phone || '–'} · {date(u.created_at)} · login {date(u.last_login_at)}</p></div>
        <div className="admin-row-actions">
          <form method="post" action="/api/admin" className="admin-inline-form"><input type="hidden" name="action" value="user.role" /><input type="hidden" name="id" value={u.id} /><select name="role" defaultValue={u.role} aria-label={a.role}><option value="customer">bewoner / resident</option><option value="provider">bedrijf / business</option><option value="admin">admin</option></select><button className="admin-btn" type="submit">{a.save}</button></form>
          {u.id !== user.id && (u.disabled_at ? <Action action="user.enable" id={u.id} label={a.enable} /> : <Action action="user.disable" id={u.id} label={a.disable} danger />)}
        </div></article>)}
    </>;
  } else if (tab === 'leads') {
    const rows = await admin.adminListLeads(user);
    body = rows.length ? <table className="admin-table"><thead><tr><th>Datum</th><th>Bedrijf</th><th>Categorie</th><th>Postcode</th><th>Status</th></tr></thead><tbody>{rows.map((l) => <tr key={l.id}><td>{date(l.created_at)}</td><td>{l.business_name}</td><td>{l.category}</td><td>{l.postcode}</td><td>{l.status}</td></tr>)}</tbody></table> : <p>{a.none}</p>;
  } else if (tab === 'inbox') {
    const { contact, submissions, emails } = await admin.adminListInbox(user);
    body = <>
      <h2>Contact</h2>
      {contact.length ? contact.map((c) => <article className={`admin-row ${c.status !== 'new' ? 'is-hidden' : ''}`} key={c.id}><div className="admin-row-main"><span className="lead-pill">{c.status}</span><h3>{c.subject || '(geen onderwerp)'}</h3><p>{c.body}</p><p>{c.name} · <a href={`mailto:${c.email}`}>{c.email}</a> · {date(c.created_at)}</p></div><div className="admin-row-actions">{c.status === 'new' && <Action action="contact.status" id={c.id} label={a.handled} extra={{ status: 'handled' }} />}</div></article>) : <p>{a.none}</p>}
      <h2>Inzendingen / submissions</h2>
      {submissions.length ? submissions.map((s) => <article className="admin-row" key={s.id}><div className="admin-row-main"><span className="lead-pill">{s.kind}</span><h3>{s.title}</h3><p>{s.description}</p><p>{s.name} · {s.email} · {date(s.created_at)}</p></div></article>) : <p>{a.none}</p>}
      <h2>{a.emailLog}</h2>
      <table className="admin-table"><thead><tr><th>Datum</th><th>Aan</th><th>Soort</th><th>Status</th></tr></thead><tbody>{emails.map((e, i) => <tr key={i}><td>{date(e.created_at)}</td><td>{e.to_address}</td><td>{e.kind}</td><td title={e.error ?? ''}>{e.status}</td></tr>)}</tbody></table>
    </>;
  }

  return <div className="ds-page"><AppHeader /><main id="main" className="platform-shell ds-platform"><div className="platform-dashboard admin-dashboard">
    <span className="uo-kicker">Uithoorn.online</span><h1>{a.title}</h1>
    <nav className="admin-tabs" aria-label={a.title}>{TABS.map((t) => <a key={t} href={href(t)} aria-current={t === tab ? 'page' : undefined} className={t === tab ? 'active' : ''}>{label[t]}</a>)}</nav>
    <section className="dashboard-section admin-section">{body}</section>
  </div></main></div>;
}
