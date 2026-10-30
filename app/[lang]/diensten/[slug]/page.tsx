import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import '../../../seo-landing.css';
import { ServiceLanding } from '../../../../components/seo/service-landing';
import { isLocale, locales, lp, type Locale } from '../../../../lib/i18n/config';
import { LEGACY_SERVICE_SLUGS, SEO_SERVICE_BY_SLUG, SEO_SERVICES, splitServiceTownSlug } from '../../../../lib/seo/services';
import { serviceListings } from '../../../../lib/seo/listings';
import { requestHrefFor, serviceMetadata } from '../../../../lib/seo/page';

// Service hub (/diensten/loodgieter: the whole area, links to each town). Old one-segment URLs such as
// /diensten/loodgieter-uithoorn redirect permanently to /diensten/loodgieter/uithoorn.
export const revalidate = 300;

type Props = { params: Promise<{ lang: string; slug: string }> };

export function generateStaticParams() {
  return locales.flatMap((lang) => [...SEO_SERVICES.map((s) => ({ lang, slug: s.slug })), ...Object.keys(LEGACY_SERVICE_SLUGS).map((slug) => ({ lang, slug }))]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw, slug } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const service = SEO_SERVICE_BY_SLUG.get(slug);
  if (!service) return { robots: { index: false } };
  return serviceMetadata(lang, service, null);
}

export default async function ServiceHubPage({ params }: Props) {
  const { lang: raw, slug } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const split = splitServiceTownSlug(slug);
  if (split) permanentRedirect(lp(lang, `/diensten/${split[0]}/${split[1]}`));
  const service = SEO_SERVICE_BY_SLUG.get(slug);
  if (!service) notFound();
  const listings = await serviceListings(service, null, lang);
  return <ServiceLanding lang={lang} service={service} town={null} listings={listings} requestHref={requestHrefFor(lang, service, `diensten-${service.slug}`)} />;
}
