import type { Metadata } from 'next';
import { LegalDocPage } from '../../../components/legal-doc';
import { alternatesFor, isLocale, type Locale } from '../../../lib/i18n/config';
import { getLegalDoc } from '../../../lib/legal/content';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return { title: getLegalDoc('terms', lang).title, alternates: alternatesFor(lang, '/voorwaarden') };
}

export default async function TermsPage({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return <LegalDocPage kind="terms" lang={lang} />;
}
