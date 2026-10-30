import type { SessionUser } from '../../../../lib/auth/session';
import { listUrgent, urgentBusinesses, urgentDetail } from '../../../../lib/admin/urgent';
import { urgentStatus } from '../../../../lib/urgent/flags';
import { channelReadiness } from '../../../../lib/urgent/channels';
import { llmProvider } from '../../../../lib/urgent/llm';
import { signToken } from '../../../../lib/urgent/tokens';
import { categoryLabel } from '../../../../lib/urgent/alerts';
import { Back, Card, Empty, fmtDate, Pill, tr, type Ctx } from '../_ui';

const LEVEL: Record<string, string> = { spoed: '🚨 spoed', today: 'vandaag', week: 'deze week', flexible: 'flexibel' };
const mins = (a: string | null, b: string | null) => (a && b ? `${Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000))} min` : '–');

export default async function Urgent({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const list = `${ctx.base}?tab=urgent`;
  if (ctx.sp.id) {
    const data = await urgentDetail(user, ctx.sp.id);
    if (!data) return <><Back href={list} label="Spoed" /><Empty>{t('Niet gevonden.', 'Not found.')}</Empty></>;
    const { request: r, log } = data;
    const photoToken = r.photos ? signToken('photo', [r.id], 1) : '';
    return <>
      <Back href={list} label="Spoed" />
      <div className="adm-title"><h2>{categoryLabel(ctx.lang, r.category)} · {r.postcode}</h2><Pill tone={r.urgency_level === 'spoed' ? 'danger' : 'default'}>{LEVEL[r.urgency_level ?? ''] ?? r.urgency_level ?? '–'}</Pill><Pill>{r.escalation_stage}</Pill></div>
      <div className="adm-grid2">
        <Card title={t('Aanvraag', 'Request')}>
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.description}</p>
          <p><strong>{t('Samenvatting', 'Summary')}:</strong> {String(r.intake?.summary ?? '–')}</p>
          <p><strong>{t('Contact', 'Contact')}:</strong> {r.contact_name} · {r.contact_phone ?? '–'} · {r.contact_email ?? '–'}</p>
          <p><strong>AI:</strong> {r.intake?.ai ? `${t('ja', 'yes')} (${String(r.intake?.provider ?? '')})` : t('nee (regels)', 'no (rules)')} · {t('voorstel', 'suggested')}: {String(r.intake?.suggestedCategory ?? '–')} / {String(r.intake?.suggestedLevel ?? '–')}</p>
          {r.photos ? <p>{Array.from({ length: r.photos }, (_, n) => <a key={n} href={`/api/urgent/photo?t=${encodeURIComponent(photoToken)}&n=${n}`} target="_blank" style={{ marginRight: 8 }}>{t('Foto', 'Photo')} {n + 1}</a>)}</p> : null}
          <p><a href={`${ctx.base}?tab=requests&id=${r.id}`}>{t('Open in Aanvragen', 'Open in Requests')} ›</a></p>
        </Card>
        <Card title={t('Tijdlijn', 'Timeline')}>
          <ul className="adm-list">
            <li><span>{t('Geplaatst', 'Posted')}: {fmtDate(ctx.lang, r.created_at)}</span></li>
            <li><span>{t('Meldingen verstuurd', 'Alerts sent')}: {fmtDate(ctx.lang, r.alerts_sent_at)} ({mins(r.created_at, r.alerts_sent_at)})</span></li>
            <li><span>{t('Geaccepteerd', 'Accepted')}: {r.business_name ? `${r.business_name} · ${fmtDate(ctx.lang, r.accepted_at)} · ${t('na', 'after')} ${mins(r.created_at, r.accepted_at)} · via ${r.accepted_via}` : '–'}</span></li>
          </ul>
        </Card>
      </div>
      <Card title={t('Meldingen per kanaal', 'Alert log per channel')}>
        {log.length ? <table className="adm-table"><thead><tr><th>{t('Tijd', 'Time')}</th><th>{t('Aan', 'To')}</th><th>{t('Kanaal', 'Channel')}</th><th>{t('Fase', 'Stage')}</th><th>Status</th><th>{t('Ontvanger', 'Recipient')}</th><th>{t('Fout', 'Error')}</th></tr></thead>
          <tbody>{log.map((a) => <tr key={a.id}><td>{fmtDate(ctx.lang, a.created_at)}</td><td>{a.business_name ?? a.audience}</td><td>{a.channel}</td><td>{a.stage}</td><td><Pill tone={a.status === 'sent' ? 'approved' : a.status === 'failed' ? 'rejected' : 'grey'}>{a.status}</Pill></td><td>{a.recipient ?? '–'}</td><td>{a.error ?? ''}</td></tr>)}</tbody></table>
          : <Empty>{t('Nog geen meldingen.', 'No alerts yet.')}</Empty>}
      </Card>
    </>;
  }
  const [rows, businesses] = await Promise.all([listUrgent(user), urgentBusinesses(user)]);
  const flags = urgentStatus(); const ch = channelReadiness(); const llm = llmProvider();
  const yes = (b: boolean) => (b ? t('aan', 'on') : t('uit', 'off'));
  return <>
    <Card title={t('Status 24/7 spoedafhandeling', '24/7 urgent handling status')}>
      <ul className="adm-list">
        <li><span>{t('Hulp-assistent (/hulp)', 'Help assistant (/hulp)')}: <strong>{yes(flags.intake)}</strong> · AI: <strong>{llm ? llm.name : t('geen sleutel, regels', 'no key, rules')}</strong></span></li>
        <li><span>{t('E-mailmeldingen met accepteerlink', 'Email alerts with accept link')}: <strong>{yes(flags.email)}</strong> · {t('escalatie', 'escalation')}: <strong>{yes(flags.escalation)}</strong> ({t('na', 'after')} {flags.escalateAfterMinutes} min)</span></li>
        <li><span>SMS: <strong>{yes(ch.sms.flag)}</strong> / {t('sleutels', 'keys')} {yes(ch.sms.credentials)} · WhatsApp ({ch.whatsapp.provider}): <strong>{yes(ch.whatsapp.flag)}</strong> / {yes(ch.whatsapp.credentials)} · {t('Bellen', 'Voice')}: <strong>{yes(ch.voice.flag)}</strong> / {yes(ch.voice.credentials)}</span></li>
        {process.env.EMAIL_REDIRECT_TO ? <li><span><Pill tone="danger">TEST</Pill> {t('Alle e-mail gaat naar', 'All email goes to')} {process.env.EMAIL_REDIRECT_TO}</span></li> : null}
      </ul>
    </Card>
    <Card title={t('Aanvragen met meldingen', 'Requests with alerts')}>
      {rows.length ? <table className="adm-table"><thead><tr><th>{t('Geplaatst', 'Posted')}</th><th>{t('Categorie', 'Category')}</th><th>{t('Urgentie', 'Urgency')}</th><th>{t('Meldingen', 'Alerts')}</th><th>{t('Escalatie', 'Escalation')}</th><th>{t('Geaccepteerd', 'Accepted')}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}>
          <td><a href={`${list}&id=${r.id}`}>{fmtDate(ctx.lang, r.created_at)}</a></td>
          <td>{categoryLabel(ctx.lang, r.category)} · {r.postcode}{r.photos ? ' 📷' : ''}</td>
          <td><Pill tone={r.urgency_level === 'spoed' ? 'danger' : 'default'}>{LEVEL[r.urgency_level ?? ''] ?? '–'}</Pill></td>
          <td>{r.businesses} {t('bedr.', 'biz')} · ✉ {r.email_sent} · sms {r.sms_sent} · wa {r.whatsapp_sent} · ☎ {r.voice_sent}{r.failed ? ` · ⚠ ${r.failed}` : ''}</td>
          <td>{r.escalation_stage}</td>
          <td>{r.business_name ? `${r.business_name} (${mins(r.created_at, r.accepted_at)})` : '–'}</td>
        </tr>)}</tbody></table> : <Empty>{t('Nog geen aanvragen via de hulp-assistent.', 'No requests via the help assistant yet.')}</Empty>}
    </Card>
    <Card title={t('Meldingsinstellingen bedrijven', 'Business alert settings')}>
      {businesses.length ? <table className="adm-table"><thead><tr><th>{t('Bedrijf', 'Business')}</th><th>{t('Categorie', 'Category')}</th><th>E-mail</th><th>SMS</th><th>WhatsApp</th><th>{t('Mobiel', 'Mobile')}</th><th>24/7</th><th>{t('Stil', 'Quiet')}</th></tr></thead>
        <tbody>{businesses.map((b) => <tr key={b.id}><td>{b.name}</td><td>{b.category}</td><td>{b.alert_email ? '✓' : ''}</td><td>{b.alert_sms ? '✓' : ''}</td><td>{b.alert_whatsapp ? '✓' : ''}</td><td>{b.alert_phone ?? ''}</td><td>{b.spoed_24_7 ? '🚨' : ''}</td><td>{b.quiet_start ? `${b.quiet_start.slice(0, 5)}–${b.quiet_end?.slice(0, 5)}` : ''}</td></tr>)}</tbody></table> : <Empty>–</Empty>}
    </Card>
  </>;
}
