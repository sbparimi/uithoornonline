import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';
import '../../../urgent.css';
import { SiteHeader } from '../../../../components/site-header';
import { SiteFooter } from '../../../../components/site-footer';
import VerifiedReviewForm from '../../../../components/verified-review-form';
import { isLocale, lp, type Locale } from '../../../../lib/i18n/config';
import { verifyToken } from '../../../../lib/urgent/tokens';
import { categoryLabel } from '../../../../lib/urgent/alerts';
import { reviewContext } from '../../../../lib/urgent/quotes';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Beoordeling · Uithoorn.online', robots: { index: false, follow: false } };

// Review booster (docs/AI_REQUESTS.md): the link in the review request after a job was marked done.
// The signed token names the request; only that job's customer has it, and one review per job.
export default async function ReviewPage({ params }: { params: Promise<{ lang: string; token: string }> }) {
  const { lang: raw, token: rawToken } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const en = lang === 'en';
  const token = decodeURIComponent(rawToken);
  const ids = verifyToken('review', token);
  if (!ids) notFound();
  const ctx = await reviewContext(ids[0]).catch(() => null);
  if (!ctx || !ctx.business_id || !ctx.business_name) notFound();
  return <div className="ds-page"><SiteHeader /><main id="main" className="uo-easy-home ui-page"><section className="ui-hero ui-hero-single"><div className="ui-card ui-job">
    <p className="ds-eyebrow"><span aria-hidden="true" />{en ? 'Review' : 'Beoordeling'} · {categoryLabel(lang, ctx.category)}</p>
    <h1>{en ? 'How did' : 'Hoe heeft'} <em>{ctx.business_name}</em> {en ? 'do?' : 'het gedaan?'}</h1>
    {ctx.status !== 'completed'
      ? <div className="ui-lost-box"><h2>{en ? 'This job is not marked as done yet' : 'Deze klus is nog niet als klaar gemarkeerd'}</h2><p>{en ? 'You can leave a review once the job is done.' : 'Je kunt een beoordeling geven zodra de klus klaar is.'}</p></div>
      : ctx.reviewed
        ? <div className="ui-won-box"><BadgeCheck aria-hidden="true" /><h2>{en ? 'You already reviewed this job' : 'Je hebt deze klus al beoordeeld'}</h2><p><a href={lp(lang, `/businesses/${ctx.business_id}`)}>{en ? `View ${ctx.business_name}` : `Bekijk ${ctx.business_name}`}</a></p></div>
        : <VerifiedReviewForm token={token} businessName={ctx.business_name} />}
  </div></section></main><SiteFooter lang={lang} /></div>;
}
