import type { Metadata } from 'next';
import DealsHub from '../../../components/deals-hub';
import { localDeals } from '../../../lib/discovery-data';
import { isLocale, seo, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

type Props = { params: Promise<{ lang: string }> };

async function langOf(params: Props['params']): Promise<Locale> {
  const { lang } = await params;
  return isLocale(lang) ? lang : 'nl';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await langOf(params);
  const t = getDictionary(lang).deals;
  return { title: t.metaTitle, description: t.metaDescription, ...seo(lang, '/deals', t.metaTitle, t.metaDescription) };
}

export default function DealsPage() {
  return <DealsHub deals={localDeals} />;
}
