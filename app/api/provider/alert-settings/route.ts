import { errorJson, handle, json, readJson, sameOrigin } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { normalizePhone } from '@/lib/phone';
import { query, queryOne } from '@/lib/db';
import { channelReadiness } from '@/lib/urgent/channels';

export const dynamic = 'force-dynamic';

type Settings = { alert_email: boolean; alert_sms: boolean; alert_whatsapp: boolean; alert_phone: string | null; spoed_24_7: boolean; quiet_start: string | null; quiet_end: string | null };
const COLS = 'alert_email, alert_sms, alert_whatsapp, alert_phone, spoed_24_7, quiet_start::text, quiet_end::text';

async function own(userId: string) {
  return queryOne<Settings & { id: string }>(`select id, ${COLS} from businesses where owner_id = $1 order by created_at limit 1`, [userId]);
}

const hm = (v: unknown) => { const s = String(v ?? '').trim(); return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null; };

// A business's job-alert preferences: channels, mobile number for alerts, 24/7 spoed, quiet hours.
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const b = await own(user.id);
    if (!b) return errorJson('provider_required', 403);
    const ready = channelReadiness();
    return json({ settings: { ...b, quiet_start: b.quiet_start?.slice(0, 5) ?? null, quiet_end: b.quiet_end?.slice(0, 5) ?? null }, channels: { sms: ready.sms.flag && ready.sms.credentials, whatsapp: ready.whatsapp.flag && ready.whatsapp.credentials, voice: ready.voice.flag && ready.voice.credentials } });
  }, 'provider/alert-settings/get');
}

export async function PATCH(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireUser();
    const limit = await rateLimit('account-action', user.id, LIMITS.accountAction);
    if (!limit.ok) return errorJson('rate_limited', 429);
    const b = await own(user.id);
    if (!b) return errorJson('provider_required', 403);
    const body = await readJson(request);
    const phone = normalizePhone(String(body.alert_phone ?? '').slice(0, 40)) || null;
    if (phone && phone.replace(/\D/g, '').length < 9) return errorJson('invalid_phone', 400);
    const v: Settings = {
      alert_email: body.alert_email !== false, alert_sms: body.alert_sms === true, alert_whatsapp: body.alert_whatsapp === true,
      alert_phone: phone, spoed_24_7: body.spoed_24_7 === true, quiet_start: hm(body.quiet_start), quiet_end: hm(body.quiet_end),
    };
    if ((v.alert_sms || v.alert_whatsapp || v.spoed_24_7) && !v.alert_phone) return errorJson('phone_required', 400);
    if (Boolean(v.quiet_start) !== Boolean(v.quiet_end)) return errorJson('quiet_hours_incomplete', 400);
    await query(`update businesses set alert_email = $2, alert_sms = $3, alert_whatsapp = $4, alert_phone = $5, spoed_24_7 = $6, quiet_start = $7, quiet_end = $8, updated_at = now() where id = $1`,
      [b.id, v.alert_email, v.alert_sms, v.alert_whatsapp, v.alert_phone, v.spoed_24_7, v.quiet_start, v.quiet_end]);
    return json({ settings: v });
  }, 'provider/alert-settings/update');
}
