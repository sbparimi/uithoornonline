import type { Metadata } from 'next';
import { Fragment } from 'react';
import { ArrowRight, BarChart3, Check, MessageCircle, MessageSquareText, Search, ShieldCheck, Target, Users } from 'lucide-react';
import { WhatsAppPlanButton } from '../../../components/whatsapp-plan-button';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { alternatesFor, isLocale, lp, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang).business;
  return { title: { absolute: t.metaTitle }, description: t.metaDescription, alternates: alternatesFor(lang, '/voor-bedrijven'), openGraph: { title: t.metaTitle, description: t.metaDescription } };
}

const planKeys = ['free', 'pro', 'pro_plus'] as const;
const prices: Record<(typeof planKeys)[number], string> = { free: '0', pro: '29', pro_plus: '59' };
const benefitIcons = [Search, Target, BarChart3, ShieldCheck];
const engineIcons = [Users, MessageSquareText, Target];

export default async function ForBusinessesPage({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang).business;
  const signup = lp(lang, '/signup/account?role=provider');
  return <div className="ds-page">
    <SiteHeader active="forBusinesses" />
    <main id="main" className="business-page ds-business">
      <section className="business-hero"><div className="business-hero-copy"><span className="business-kicker">{t.kicker}</span><h1>{t.title}</h1><p>{t.intro}</p><div className="business-hero-actions"><a className="business-main-cta" href={signup}>{t.claim} <ArrowRight aria-hidden="true" /></a><a className="business-secondary-cta" href="#prijzen">{t.seePricing}</a></div><a className="business-dashboard-link" href={lp(lang, '/provider')}>{t.dashboard} <ArrowRight aria-hidden="true" /></a></div><div className="business-hero-proof">{t.flow.map(([title, text], i) => <Fragment key={title}>{i > 0 && <ArrowRight aria-hidden="true" />}<div><strong>{title}</strong><span>{text}</span></div></Fragment>)}</div></section>
      <section className="business-benefits"><div className="business-section-intro"><span className="business-kicker">{t.benefitsKicker}</span><h2>{t.benefitsTitle}</h2></div><div className="business-benefit-grid">{t.benefits.map(([title, text], i) => { const Icon = benefitIcons[i]; return <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>; })}</div></section>
      <section className="business-pricing" id="prijzen"><div className="business-section-intro centered"><span className="business-kicker">{t.pricingKicker}</span><h2>{t.pricingTitle}</h2><p>{t.pricingText}</p></div><div className="pricing-grid">{planKeys.map((key) => { const [name, description, features, cta] = t.plans[key]; return <article key={key} className={`pricing-card ${key === 'pro_plus' ? 'featured' : ''}`}>{key === 'pro_plus' ? <span className="pricing-badge">{t.popular}</span> : null}<div className="pricing-head"><h3>{name}</h3><p>{description}</p></div><div className="pricing-price"><strong>€{prices[key]}</strong>{key !== 'free' ? <span>{t.perMonth}</span> : null}</div><ul>{features.map(feature => <li key={feature}><Check aria-hidden="true" />{feature}</li>)}</ul>{key === 'free' ? <a className="pricing-button" href={signup}>{cta}<ArrowRight aria-hidden="true" /></a> : <WhatsAppPlanButton plan={name} price={prices[key]} />}</article>; })}</div><div className="whatsapp-payment-note" id="whatsapp"><MessageCircle aria-hidden="true" /><div><strong>{t.noteTitle}</strong><span>{t.noteText}</span></div></div></section>
      <section className="business-lead-engine"><div><span className="business-kicker">{t.engineKicker}</span><h2>{t.engineTitle}</h2><p>{t.engineText}</p></div><div className="business-lead-flow">{t.engine.map(([title, text], i) => { const Icon = engineIcons[i]; return <Fragment key={title}>{i > 0 && <ArrowRight aria-hidden="true" />}<div><Icon aria-hidden="true" /><strong>{title}</strong><span>{text}</span></div></Fragment>; })}</div></section>
      <section className="business-final-cta"><span className="business-kicker">{t.finalKicker}</span><h2>{t.finalTitle}</h2><p>{t.finalText}</p><a className="business-main-cta" href={signup}>{t.finalCta} <ArrowRight aria-hidden="true" /></a></section>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
