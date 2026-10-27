import type { Metadata, Viewport } from 'next';
import '../globals.css';
import '../uo.css';
import '../speakin-theme.css';
import '../uopages.css';
import '../locale.css';
import '../brand-proof-fixes.css';
import '../provider-profile.css';
import '../agentic-home.css';
import '../eci-theme.css';
import '../agent-chat.css';
import '../home-chat-overrides.css';
import '../discovery-pages.css';
import '../directory-conversion.css';
import '../featured-ad.css';
import '../home-services.css';
import '../directory-marketplace.css';
import '../marketplace-trust.css';
import '../service-landing.css';
import '../easy-redesign.css';
import '../directory-easy.css';
import '../apple-redesign.css';
import '../spiceindia-ad.css';
import '../business-monetization.css';
import '../monetization-overrides.css';
import '../design-system.css';
import '../backend.css';
import '../folk.css';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import { Analytics } from '@vercel/analytics/next';
import { LangProvider } from '../../components/lang-context';
import { SpiceIndiaAd } from '../../components/spiceindia-ad';
import { alternatesFor, isLocale, locales, ogLocale, SITE_URL, type Locale } from '../../lib/i18n/config';
import { getDictionary } from '../../lib/i18n/dictionaries';

const folkSerif = localFont({
  src: [
    { path: '../fonts/averia-serif-libre-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/averia-serif-libre-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-serif',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});
const folkHand = localFont({ src: '../fonts/caveat-600.woff2', weight: '600', variable: '--font-hand', display: 'swap', fallback: ['cursive'] });

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const viewport: Viewport = { themeColor: '#f5f6f8', width: 'device-width', initialScale: 1 };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t.meta.homeTitle, template: `%s${t.meta.titleSuffix}` },
    description: t.meta.homeDescription,
    applicationName: 'Uithoorn.online',
    icons: { icon: '/icon.svg', shortcut: '/icon.svg' },
    alternates: alternatesFor(lang, '/'),
    openGraph: { type: 'website', siteName: 'Uithoorn.online', locale: ogLocale(lang), alternateLocale: [ogLocale(lang === 'nl' ? 'en' : 'nl')], title: t.meta.homeTitle, description: t.meta.homeDescription, url: lang === 'nl' ? SITE_URL : `${SITE_URL}/en`, images: [{ url: lang === 'nl' ? '/og-image.png' : '/og-image-en.png', width: 1200, height: 630, alt: 'Uithoorn.online' }] },
    twitter: { card: 'summary_large_image', title: t.meta.homeTitle, description: t.meta.homeDescription, images: [lang === 'nl' ? '/og-image.png' : '/og-image-en.png'] },
    formatDetection: { telephone: false },
  };
}

export default async function RootLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <html lang={lang === 'nl' ? 'nl-NL' : 'en'} className={`${folkSerif.variable} ${folkHand.variable}`}>
      <body className="ds folk">
        <a className="skip-link" href="#main">{t.common.skip}</a>
        <LangProvider lang={lang}>
          {children}
          <SpiceIndiaAd />
        </LangProvider>
        {/* Cookieless page-view analytics (no consent banner needed). */}
        <Analytics />
      </body>
    </html>
  );
}
