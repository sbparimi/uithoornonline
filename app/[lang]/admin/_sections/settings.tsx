import type { SessionUser } from '../../../../lib/auth/session';
import { listPlansAdmin } from '../../../../lib/admin/misc';
import { adminEmail, emailConfigured, fromAddress } from '../../../../lib/email/send';
import { CONTACT_EMAIL } from '../../../../lib/contact';
import { WHATSAPP_NUMBER, lp } from '../../../../lib/i18n/config';
import { Card, Field, Form, tr, type Ctx } from '../_ui';
import { PRICING_ENABLED } from '../../../../lib/pricing';

export default async function Settings({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const plans = await listPlansAdmin(user);
  const yes = (v: boolean) => (v ? t('ja', 'yes') : t('nee', 'no'));
  return <>
    <Card title={PRICING_ENABLED ? t('Pakketten', 'Plans') : t('Pakketten (nu niet in gebruik)', 'Plans (currently unused)')}>
      {!PRICING_ENABLED && <p className="adm-hint">{t('Prijzen staan uit: alles is gratis en leads zijn onbeperkt. Deze gegevens worden bewaard voor als prijzen terugkomen.', 'Pricing is switched off: everything is free and leads are unlimited. This data is kept for when pricing returns.')}</p>}
      <p className="adm-hint">{t('Het aantal leads per maand geldt direct voor de leadlimiet. Prijzen op de publieke pagina’s staan in de teksten van de site.', 'Leads per month apply to the lead limit right away. Prices on the public pages are part of the site texts.')}</p>
      {plans.map((p) => <Form key={p.key} ctx={ctx} action="plan.update" extra={{ key: p.key }} className="adm-form adm-row-form">
        <Field label={t('Naam', 'Name')}><input name="name" required maxLength={40} defaultValue={p.name} /></Field>
        <Field label={t('Prijs p/m (€)', 'Price p/m (€)')}><input name="price" inputMode="decimal" defaultValue={(p.monthly_price_cents / 100).toFixed(2).replace('.', ',')} /></Field>
        <Field label={t('Leads per maand', 'Leads per month')}><input name="included_leads" type="number" min={0} max={10000} defaultValue={p.included_leads} /></Field>
        <button className="adm-btn" type="submit">{t('Opslaan', 'Save')}</button>
      </Form>)}
    </Card>
    <Card title={t('E-mail & configuratie', 'Email & configuration')}>
      <dl className="adm-dl">
        <dt>{t('E-mail aan', 'Email on')}</dt><dd>{yes(emailConfigured())}</dd>
        <dt>{t('Afzender', 'Sender')}</dt><dd>{fromAddress()}</dd>
        <dt>{t('Admin-adres (krijgt alles)', 'Admin address (gets everything)')}</dt><dd>{adminEmail()}</dd>
        <dt>{t('Antwoordadres / publiek contact', 'Reply-to / public contact')}</dt><dd>{CONTACT_EMAIL}</dd>
        <dt>{t('Inkomende e-mail (webhook)', 'Inbound email (webhook)')}</dt><dd>{yes(Boolean(process.env.RESEND_WEBHOOK_SECRET))} · /api/email/inbound</dd>
        <dt>WhatsApp</dt><dd>+{WHATSAPP_NUMBER}</dd>
        <dt>{t('Site-URL', 'Site URL')}</dt><dd>{process.env.NEXT_PUBLIC_SITE_URL || 'https://uithoorn.online'}</dd>
      </dl>
      <p className="adm-hint">{t('Deze waarden komen uit de Vercel-omgeving (ADMIN_EMAIL, RESEND_FROM_EMAIL, …).', 'These values come from the Vercel environment (ADMIN_EMAIL, RESEND_FROM_EMAIL, …).')}</p>
    </Card>
    <Card title={t('Jouw account', 'Your account')}>
      <p>{user.email}</p>
      <p><a className="adm-btn" href={lp(ctx.lang, '/account/settings')}>{t('Wachtwoord wijzigen', 'Change password')}</a></p>
    </Card>
  </>;
}
