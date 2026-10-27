import 'server-only';

// Spam protection for public forms without a third-party captcha (no cookies, no tracking):
// 1. Honeypot: a visually hidden field named `company_website` that people never fill in.
// 2. Time trap: the form sends `form_started_at` (ms since epoch, set when the form mounted);
//    a submission faster than MIN_FILL_MS is treated as automated.
// Forms render <SpamTrap /> (components/spam-trap.tsx) to include both fields.

export const HONEYPOT_FIELD = 'company_website';
export const STARTED_FIELD = 'form_started_at';
const MIN_FILL_MS = 2500;
const MAX_AGE_MS = 1000 * 60 * 60 * 24;

export function looksLikeSpam(body: Record<string, unknown>): string | null {
  const honey = String(body[HONEYPOT_FIELD] ?? '').trim();
  if (honey) return 'honeypot';
  const started = Number(body[STARTED_FIELD]);
  if (!Number.isFinite(started) || started <= 0) return 'missing_timer';
  const elapsed = Date.now() - started;
  if (elapsed < MIN_FILL_MS) return 'too_fast';
  if (elapsed > MAX_AGE_MS) return 'stale_form';
  return null;
}
