import type { SessionUser } from '../../../../lib/auth/session';
import { listReviews } from '../../../../lib/admin/misc';
import { Act, Empty, fmtDate, Pill, tr, type Ctx } from '../_ui';

export default async function Reviews({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const rows = await listReviews(user);
  return rows.length ? <>{rows.map((r) => <article className={`admin-row adm-row ${r.hidden ? 'is-hidden' : ''}`} key={r.id}>
    <div className="admin-row-main"><div className="adm-row-top"><Pill tone="plan">{'★'.repeat(r.rating)}</Pill>{r.hidden ? <Pill tone="grey">{t('verborgen', 'hidden')}</Pill> : null}</div><h3>{r.business_name}</h3><p>{r.body || '–'}</p><p className="adm-muted">{r.customer_email} · {fmtDate(ctx.lang, r.created_at)}</p></div>
    <div className="admin-row-actions">{r.hidden ? <Act ctx={ctx} action="review.unhide" id={r.id} label={t('Tonen', 'Unhide')} /> : <Act ctx={ctx} action="review.hide" id={r.id} label={t('Verbergen', 'Hide')} tone="danger" />}</div>
  </article>)}</> : <Empty>{t('Nog geen reviews.', 'No reviews yet.')}</Empty>;
}
