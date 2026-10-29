import type { ReactNode } from 'react';
import type { Locale } from '../../../lib/i18n/config';
import { dateLocale } from '../../../lib/i18n/config';

// Small server-rendered building blocks for the admin console. Everything is a plain HTML form that
// posts to /api/admin (no client JS needed); the API redirects back here with ?ok= or ?err=.

export type Ctx = { lang: Locale; ret: string; base: string; sp: Record<string, string | undefined> };
export const tr = (lang: Locale) => (nl: string, en: string) => (lang === 'en' ? en : nl);

export function fmtDate(lang: Locale, v: string | Date | null | undefined, withTime = true) {
  if (!v) return '–';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleString(dateLocale(lang), withTime ? { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' } : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' });
}
export const eur = (cents: number | null | undefined) => `€${((cents ?? 0) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Form({ ctx, action, id, children, className, extra }: { ctx: Ctx; action: string; id?: string; children: ReactNode; className?: string; extra?: Record<string, string> }) {
  return <form method="post" action="/api/admin" className={className ?? 'adm-form'}>
    <input type="hidden" name="action" value={action} />
    {id ? <input type="hidden" name="id" value={id} /> : null}
    <input type="hidden" name="return" value={ctx.ret} />
    <input type="hidden" name="lang" value={ctx.lang} />
    {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    {children}
  </form>;
}

/** One-button form (quick actions in lists). */
export function Act({ ctx, action, id, label, extra, tone }: { ctx: Ctx; action: string; id: string; label: string; extra?: Record<string, string>; tone?: 'danger' | 'primary' | 'ghost' }) {
  return <Form ctx={ctx} action={action} id={id} extra={extra} className="admin-inline-form adm-inline">
    <button type="submit" className={`admin-btn adm-btn ${tone === 'danger' ? 'danger adm-danger' : tone === 'primary' ? 'adm-primary' : ''}`}>{label}</button>
  </Form>;
}

export function Field({ label, children, wide, hint }: { label: string; children: ReactNode; wide?: boolean; hint?: string }) {
  return <label className={`adm-field ${wide ? 'adm-wide' : ''}`}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

export function Pill({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`lead-pill adm-pill adm-pill-${tone ?? 'default'}`}>{children}</span>;
}

export function Card({ title, children, actions, id }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; id?: string }) {
  return <section className="adm-card" id={id}>{(title || actions) && <div className="adm-card-head">{title ? <h2>{title}</h2> : <span />}{actions}</div>}{children}</section>;
}

export function Empty({ children }: { children: ReactNode }) { return <p className="adm-empty">{children}</p>; }

export function Toolbar({ ctx, tab, children, csv, createHref, createLabel }: { ctx: Ctx; tab: string; children?: ReactNode; csv?: string; createHref?: string; createLabel?: string }) {
  const t = tr(ctx.lang);
  return <div className="adm-toolbar">
    <form method="get" className="adm-filters" action={ctx.base}>
      <input type="hidden" name="tab" value={tab} />
      <input name="q" type="search" defaultValue={ctx.sp.q ?? ''} placeholder={t('Zoeken…', 'Search…')} aria-label={t('Zoeken', 'Search')} />
      {children}
      <button type="submit" className="adm-btn">{t('Filter', 'Filter')}</button>
    </form>
    <div className="adm-toolbar-actions">
      {csv ? <a className="adm-btn adm-ghost" href={csv}>CSV</a> : null}
      {createHref ? <a className="adm-btn adm-primary" href={createHref}>+ {createLabel ?? t('Nieuw', 'New')}</a> : null}
    </div>
  </div>;
}

export function Select({ name, value, options, label, allLabel }: { name: string; value?: string; options: [string, string][]; label: string; allLabel?: string }) {
  return <select name={name} defaultValue={value ?? ''} aria-label={label}>{allLabel !== undefined ? <option value="">{allLabel}</option> : null}{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}

export function Pager({ ctx, tab, page, pages, total }: { ctx: Ctx; tab: string; page: number; pages: number; total: number }) {
  const t = tr(ctx.lang);
  const href = (p: number) => { const q = new URLSearchParams(); for (const [k, v] of Object.entries(ctx.sp)) if (v && !['ok', 'err', 'page', 'id', 'edit'].includes(k)) q.set(k, v); q.set('tab', tab); q.set('page', String(p)); return `${ctx.base}?${q}`; };
  return <nav className="adm-pager" aria-label={t('Pagina’s', 'Pages')}>
    <span>{total} {t('resultaten', 'results')} · {t('pagina', 'page')} {page}/{pages}</span>
    <span>{page > 1 ? <a className="adm-btn" href={href(page - 1)}>‹ {t('Vorige', 'Previous')}</a> : null}{page < pages ? <a className="adm-btn" href={href(page + 1)}>{t('Volgende', 'Next')} ›</a> : null}</span>
  </nav>;
}

export function csvHref(ctx: Ctx, type: string) {
  const q = new URLSearchParams(); q.set('type', type);
  for (const [k, v] of Object.entries(ctx.sp)) if (v && !['ok', 'err', 'page', 'id', 'edit', 'tab'].includes(k)) q.set(k, v);
  return `/api/admin/export?${q}`;
}

export function DangerZone({ ctx, action, id, label, confirmLabel, confirmValue, extra }: { ctx: Ctx; action: string; id: string; label: string; confirmLabel: string; confirmValue: string; extra?: Record<string, string> }) {
  const t = tr(ctx.lang);
  return <details className="adm-danger-zone"><summary>{t('Verwijderen…', 'Delete…')}</summary>
    <Form ctx={ctx} action={action} id={id} extra={extra}>
      <Field label={confirmLabel} wide><input name="confirm" required autoComplete="off" placeholder={confirmValue} pattern={confirmValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} /></Field>
      <button type="submit" className="adm-btn adm-danger danger">{label}</button>
    </Form>
  </details>;
}

export function Back({ href, label }: { href: string; label: string }) {
  return <a className="adm-back" href={href}>‹ {label}</a>;
}

export function MigrationNotice({ lang }: { lang: Locale }) {
  return <p className="adm-flash adm-flash-warn" role="status">{tr(lang)('Dit onderdeel heeft database-migratie 0002 nodig. Die wordt bij het live zetten uitgevoerd.', 'This section needs database migration 0002, which runs when this goes live.')}</p>;
}
