import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../../../urgent.css';
import { SiteHeader } from '../../../../../components/site-header';
import { SiteFooter } from '../../../../../components/site-footer';
import UrgentStatus from '../../../../../components/urgent-status';
import { isLocale, type Locale } from '../../../../../lib/i18n/config';
import { verifyToken } from '../../../../../lib/urgent/tokens';
import { escalateAfterMinutes, whatsappContactNumber } from '../../../../../lib/urgent/flags';
import { getDictionary } from '../../../../../lib/i18n/dictionaries';
import { REQUEST_CATEGORIES } from '../../../../../lib/request-options';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Status · Uithoorn.online', robots: { index: false, follow: false } };

export default async function StatusPage({ params }: { params: Promise<{ lang: string; token: string }> }) {
  const { lang: raw, token } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  if (!verifyToken('status', decodeURIComponent(token))) notFound();
  const whatsapp = whatsappContactNumber();
  const names = getDictionary(lang).requestForm.categories as Record<string, string>;
  const labels: [string, string][] = whatsapp ? REQUEST_CATEGORIES.map((v) => [v, names[v] ?? v]) : [];
  return <div className="ds-page"><SiteHeader /><main id="main" className="uo-easy-home ui-page"><section className="ui-hero ui-hero-single"><div className="ui-card">
    <UrgentStatus token={decodeURIComponent(token)} escalateMinutes={escalateAfterMinutes()} whatsapp={whatsapp} labels={labels} />
  </div></section></main><SiteFooter lang={lang} /></div>;
}
