import { errorJson, handle, json, readJson, sameOrigin, str } from '@/lib/http';
import { clientIp, LIMITS, rateLimit } from '@/lib/security/rate-limit';
import { looksLikeSpam } from '@/lib/security/spam';
import { normalizeEmail } from '@/lib/data/users';
import { createContactMessage } from '@/lib/data/misc';
import { notify } from '@/lib/notify';
import { sendEmail } from '@/lib/email/send';
import { contactAutoReplyEmail } from '@/lib/email/templates';
import { after } from 'next/server';

export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const body = await readJson(request);
    if (looksLikeSpam(body)) return errorJson('rejected', 400);
    const limit = await rateLimit('contact-ip', clientIp(request), LIMITS.contactIp);
    if (!limit.ok) return errorJson('rate_limited', 429, { retryAfter: limit.retryAfter });
    const name = str(body.name, 120); const email = normalizeEmail(body.email);
    const subject = str(body.subject, 200); const message = str(body.message ?? body.body, 5000);
    if (name.length < 2 || !email || message.length < 10) return errorJson('invalid_contact', 400);
    const row = await createContactMessage({ name, email, subject, body: message });
    const lang = body.lang === 'en' ? 'en' : 'nl';
    after(() => sendEmail({ to: email, kind: 'contact_auto_reply', lang, ref: row?.id ? `contact:${row.id}` : undefined, ...contactAutoReplyEmail(lang, name, message) }));
    after(() => notify('new_contact', subject || message.slice(0, 60), { name, email, message }));
    return json({ id: row?.id, ok: true }, 201);
  }, 'contact');
}
