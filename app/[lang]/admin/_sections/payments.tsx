import type { SessionUser } from '../../../../lib/auth/session';
import * as P from '../../../../lib/admin/payments';
import { businessOptions } from '../../../../lib/admin/businesses';
import { Act, Back, Card, csvHref, Empty, eur, Field, fmtDate, Form, MigrationNotice, Pager, Pill, Select, Toolbar, tr, type Ctx } from '../_ui';
import { PRICING_ENABLED } from '../../../../lib/pricing';

function PaymentForm({ ctx, p, businesses, create }: { ctx: Ctx; p?: Partial<P.Payment>; businesses: { id: string; name: string }[]; create?: boolean }) {
  const t = tr(ctx.lang);
  const today = new Date().toISOString().slice(0, 10);
  return <Form ctx={ctx} action={create ? 'payment.create' : 'payment.update'} id={create ? undefined : p?.id}>
    <div className="adm-fields">
      <Field label={t('Bedrijf', 'Business')}><select name="business_id" defaultValue={p?.business_id ?? ctx.sp.business_id ?? ''}><option value="">{t('— geen —', '— none —')}</option>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      <Field label={t('Bedrag (€)', 'Amount (€)')}><input name="amount" required inputMode="decimal" defaultValue={p?.amount_cents !== undefined ? (p.amount_cents / 100).toFixed(2).replace('.', ',') : ''} placeholder="29,00" /></Field>
      <Field label={t('Soort', 'Type')}><Select name="kind" value={p?.kind ?? 'plan'} label="kind" options={[['plan', t('Pakket', 'Plan')], ['lead', t('Losse lead(s)', 'Single lead(s)')], ['other', t('Overig', 'Other')]]} /></Field>
      <Field label={t('Pakket', 'Plan')} hint={t('Bij soort Pakket', 'For type Plan')}><Select name="plan_key" value={p?.plan_key ?? 'pro'} label="plan" options={[['pro', 'Pro (€29)'], ['pro_plus', 'Pro+ (€59)'], ['free', 'Gratis']]} /></Field>
      <Field label={t('Maanden', 'Months')}><input name="months" type="number" min={1} max={24} defaultValue={p?.months ?? 1} /></Field>
      <Field label={t('Aantal leads', 'Number of leads')} hint={t('Bij losse leads (€10 per lead)', 'For single leads (€10 each)')}><input name="lead_credits" type="number" min={0} max={1000} defaultValue={p?.lead_credits ?? 0} /></Field>
      <Field label={t('Betaalwijze', 'Method')}><Select name="method" value={p?.method ?? 'whatsapp'} label="method" options={[['whatsapp', 'WhatsApp'], ['tikkie', 'Tikkie'], ['bank', t('Bank', 'Bank transfer')], ['cash', t('Contant', 'Cash')], ['other', t('Anders', 'Other')]]} /></Field>
      <Field label="Status"><Select name="status" value={p?.status ?? 'paid'} label="status" options={[['paid', t('Betaald', 'Paid')], ['unpaid', t('Onbetaald', 'Unpaid')], ['refunded', t('Terugbetaald', 'Refunded')]]} /></Field>
      <Field label={t('Betaaldatum', 'Paid on')}><input name="paid_on" type="date" defaultValue={p?.paid_on ? String(p.paid_on).slice(0, 10) : today} /></Field>
      <Field label={t('Notitie', 'Note')} wide><input name="note" maxLength={1000} defaultValue={p?.note ?? ''} /></Field>
    </div>
    <div className="adm-checks"><label><input type="checkbox" name="send_receipt" defaultChecked={create} /> {t('Stuur betaalbewijs naar de eigenaar (als betaald)', 'Email a receipt to the owner (when paid)')}</label></div>
    {!PRICING_ENABLED && <p className="adm-hint">{t('Prijzen staan uit: alles is gratis en leads zijn onbeperkt. Deze gegevens worden bewaard voor als prijzen terugkomen.', 'Pricing is switched off: everything is free and leads are unlimited. This data is kept for when pricing returns.')}</p>}
    <p className="adm-hint">{t('Betaald = direct verwerkt: een pakketbetaling zet het pakket voor het aantal maanden, losse leads worden credits. Vergrendelde leads van deze maand gaan dan open.', 'Paid = applied at once: a plan payment sets the plan for the given months, single leads become credits. This month’s locked leads then unlock.')}</p>
    <button type="submit" className="adm-btn adm-primary">{create ? t('Betaling vastleggen', 'Record payment') : t('Opslaan', 'Save')}</button>
  </Form>;
}

export default async function Payments({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const list = `${ctx.base}?tab=payments`;
  const businesses = await businessOptions(user);
  if (ctx.sp.id === 'new') return <><Back href={list} label={t('Betalingen', 'Payments')} /><Card title={t('Betaling vastleggen', 'Record a payment')}><PaymentForm ctx={ctx} businesses={businesses} create /></Card></>;
  if (ctx.sp.id) {
    const p = await P.getPayment(user, ctx.sp.id);
    if (!p) return <><Back href={list} label={t('Betalingen', 'Payments')} /><Empty>{t('Niet gevonden.', 'Not found.')}</Empty></>;
    return <>
      <Back href={list} label={t('Betalingen', 'Payments')} />
      <div className="adm-title"><h2>{eur(p.amount_cents)} · {p.business_name || '–'}</h2><Pill tone={p.status}>{p.status}</Pill>{p.applied_at ? <Pill tone="approved">{t('verwerkt', 'applied')}</Pill> : null}</div>
      <div className="adm-quick">
        {p.status !== 'paid' ? <Act ctx={ctx} action="payment.paid" id={p.id} label={t('Markeer betaald', 'Mark paid')} tone="primary" extra={{ send_receipt: 'true' }} /> : <Act ctx={ctx} action="payment.unpaid" id={p.id} label={t('Markeer onbetaald', 'Mark unpaid')} />}
        {p.status === 'paid' && p.owner_email ? <Act ctx={ctx} action="payment.receipt" id={p.id} label={p.receipt_sent_at ? t('Betaalbewijs opnieuw sturen', 'Resend receipt') : t('Stuur betaalbewijs', 'Send receipt')} /> : null}
      </div>
      <Card title={t('Bewerken', 'Edit')}><PaymentForm ctx={ctx} p={p} businesses={businesses} /></Card>
      <p className="adm-meta">{t('Vastgelegd', 'Recorded')} {fmtDate(ctx.lang, p.created_at)} · {t('verwerkt', 'applied')} {fmtDate(ctx.lang, p.applied_at)} · {t('betaalbewijs', 'receipt')} {fmtDate(ctx.lang, p.receipt_sent_at)} · ref {p.id.slice(0, 8).toUpperCase()}</p>
      <details className="adm-danger-zone"><summary>{t('Verwijderen…', 'Delete…')}</summary><p className="adm-hint">{t('Losse-lead-credits van deze betaling worden teruggedraaid; een pakket blijft staan (pas dat aan bij het bedrijf).', 'Single-lead credits from this payment are reverted; a plan stays as is (change it on the business).')}</p><Act ctx={ctx} action="payment.delete" id={p.id} label={t('Betaling verwijderen', 'Delete payment')} tone="danger" /></details>
    </>;
  }
  const [data, totals] = await Promise.all([P.listPayments(user, ctx.sp), P.monthlyTotals(user)]);
  if (!data) return <MigrationNotice lang={ctx.lang} />;
  return <>
    <Toolbar ctx={ctx} tab="payments" csv={csvHref(ctx, 'payments')} createHref={`${ctx.base}?tab=payments&id=new`} createLabel={t('Betaling', 'Payment')}>
      <Select name="status" value={ctx.sp.status} label="Status" allLabel={t('Alle', 'All')} options={[['paid', t('Betaald', 'Paid')], ['unpaid', t('Onbetaald', 'Unpaid')], ['refunded', t('Terugbetaald', 'Refunded')]]} />
      <input name="month" type="month" defaultValue={ctx.sp.month ?? ''} aria-label={t('Maand', 'Month')} />
    </Toolbar>
    {totals.length ? <div className="adm-months">{totals.map((m) => <a key={m.month} href={`${ctx.base}?tab=payments&month=${m.month}`} className={ctx.sp.month === m.month ? 'active' : ''}><span>{m.month}</span><strong>{eur(m.paid_cents)}</strong><small>{m.paid_count} {t('betaald', 'paid')}{m.unpaid_count ? ` · ${eur(m.unpaid_cents)} ${t('open', 'unpaid')}` : ''}</small></a>)}</div> : null}
    {data.rows.length ? data.rows.map((p) => <article className="admin-row adm-row" key={p.id}>
      <div className="admin-row-main"><div className="adm-row-top"><Pill tone={p.status}>{p.status}</Pill><Pill tone="plan">{P.describePayment(p, ctx.lang)}</Pill></div>
        <h3><a href={`${ctx.base}?tab=payments&id=${p.id}`}>{eur(p.amount_cents)} · {p.business_name || '–'}</a></h3><p className="adm-muted">{p.method} · {fmtDate(ctx.lang, p.paid_on ?? p.created_at, false)}{p.note ? ` · ${p.note}` : ''}</p></div>
      <div className="admin-row-actions">{p.status !== 'paid' ? <Act ctx={ctx} action="payment.paid" id={p.id} label={t('Betaald', 'Paid')} tone="primary" extra={{ send_receipt: 'true' }} /> : null}<a className="adm-btn" href={`${ctx.base}?tab=payments&id=${p.id}`}>{t('Bewerken', 'Edit')}</a></div>
    </article>) : <Empty>{t('Nog geen betalingen.', 'No payments yet.')}</Empty>}
    <Pager ctx={ctx} tab="payments" page={data.page} pages={data.pages} total={data.total} />
  </>;
}
