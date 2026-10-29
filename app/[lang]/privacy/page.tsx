import type { Metadata } from 'next';
import { LegalDocPage } from '../../../components/legal-doc';
import { seo, isLocale, type Locale } from '../../../lib/i18n/config';
import { getLegalDoc } from '../../../lib/legal/content';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const doc = getLegalDoc('privacy', lang);
  return { title: doc.title, description: doc.intro.slice(0, 155), ...seo(lang, '/privacy', doc.title, doc.intro.slice(0, 155)) };
}

export default async function Page({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return <LegalDocPage kind="privacy" lang={lang} />;
}
