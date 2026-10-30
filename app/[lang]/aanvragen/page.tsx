import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isLocale, lp, type Locale } from '../../../lib/i18n/config';
import { intakeEnabled } from '../../../lib/urgent/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: true } };

// Stable short link for print and posts (flyer QR: uithoorn.online/aanvragen). Goes to the AI help
// assistant (/hulp) when it is switched on, else to the classic request form, keeping ?bron=… .
export default async function RequestShortLink({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const bron = String((Array.isArray(sp.bron) ? sp.bron[0] : sp.bron) || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
  redirect(`${lp(lang, intakeEnabled() ? '/hulp' : '/request')}${bron ? `?bron=${bron}` : ''}`);
}
