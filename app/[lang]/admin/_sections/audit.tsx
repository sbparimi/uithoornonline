import type { SessionUser } from '../../../../lib/auth/session';
import { listAudit } from '../../../../lib/admin/misc';
import { csvHref, Empty, fmtDate, Pager, Toolbar, tr, type Ctx } from '../_ui';

function Diff({ details }: { details: Record<string, unknown> }) {
  const before = (details.before ?? null) as Record<string, unknown> | null;
  const after = (details.after ?? null) as Record<string, unknown> | null;
  if (!before && !after) return <code className="adm-json">{JSON.stringify(details).slice(0, 300)}</code>;
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => !['updated_at', 'created_at'].includes(k) && JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  if (!keys.length) return <span className="adm-muted">–</span>;
  return <ul className="adm-diff">{keys.slice(0, 12).map((k) => <li key={k}><b>{k}</b>: <del>{before ? String(JSON.stringify(before[k]) ?? '–').slice(0, 80) : '–'}</del> → <ins>{after ? String(JSON.stringify(after[k]) ?? '–').slice(0, 80) : '–'}</ins></li>)}</ul>;
}

export default async function Audit({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const data = await listAudit(user, ctx.sp);
  return <>
    <Toolbar ctx={ctx} tab="audit" csv={csvHref(ctx, 'audit')} />
    {data.rows.length ? data.rows.map((a) => <article className="adm-row adm-audit" key={a.id}>
      <div><p><code>{a.action}</code> · {a.target_type}{a.target_id ? <span className="adm-muted"> {a.target_id.slice(0, 36)}</span> : null}</p><Diff details={a.details} /></div>
      <p className="adm-muted">{a.actor_email ?? String(a.details?.actor_email ?? 'system')} · {fmtDate(ctx.lang, a.created_at)}</p>
    </article>) : <Empty>{t('Nog niets gelogd.', 'Nothing logged yet.')}</Empty>}
    <Pager ctx={ctx} tab="audit" page={data.page} pages={data.pages} total={data.total} />
  </>;
}
