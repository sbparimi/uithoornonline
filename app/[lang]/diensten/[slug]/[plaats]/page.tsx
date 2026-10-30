import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../../../seo-landing.css';
import { ServiceLanding } from '../../../../../components/seo/service-landing';
import { isLocale, locales, type Locale } from '../../../../../lib/i18n/config';
import { SEO_SERVICE_BY_SLUG, SEO_SERVICES, SEO_TOWN_BY_SLUG, SEO_TOWNS } from '../../../../../lib/seo/services';
import { serviceListings } from '../../../../../lib/seo/listings';
import { requestHrefFor, serviceMetadata } from '../../../../../lib/seo/page';

// Service × town landing page, e.g. /diensten/loodgieter/de-kwakel. Listings refresh every 5 minutes.
export const revalidate = 300;

type Props = { params: Promise<{ lang: string; slug: string; plaats: string }> };

export function generateStaticParams() {
  return locales.flatMap((lang) => SEO_SERVICES.flatMap((s) => SEO_TOWNS.map((t) => ({ lang, slug: s.slug, plaats: t.slug }))));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw, slug, plaats } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const service = SEO_SERVICE_BY_SLUG.get(slug);
  const town = SEO_TOWN_BY_SLUG.get(plaats);
  if (!service || !town) return { robots: { index: false } };
  return serviceMetadata(lang, service, town);
}

export default async function ServiceTownPage({ params }: Props) {
  const { lang: raw, slug, plaats } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const service = SEO_SERVICE_BY_SLUG.get(slug);
  const town = SEO_TOWN_BY_SLUG.get(plaats);
  if (!service || !town) notFound();
  const listings = await serviceListings(service, town, lang);
  return <ServiceLanding lang={lang} service={service} town={town} listings={listings} requestHref={requestHrefFor(lang, service, `diensten-${service.slug}-${town.slug}`)} />;
}
