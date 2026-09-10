import type { Metadata } from 'next';
import './globals.css';
import './uo.css';
import './speakin-theme.css';
import './uopages.css';
import './locale.css';
import './brand-proof-fixes.css';
import './provider-profile.css';
import './agentic-home.css';
import './eci-theme.css';
import './agent-chat.css';
import './home-chat-overrides.css';
import './discovery-pages.css';
import './directory-conversion.css';
import './featured-ad.css';
import './home-services.css';
import './directory-marketplace.css';
import './marketplace-trust.css';
import './service-landing.css';
import './easy-redesign.css';
import './directory-easy.css';
import './apple-redesign.css';
import './spiceindia-ad.css';
import './business-monetization.css';
import './monetization-overrides.css';
import { LocaleProvider } from '../components/locale-provider';
import { SpiceIndiaAd } from '../components/spiceindia-ad';

export const metadata: Metadata = {
  title: 'Uithoorn.online — Lokale hulp, eenvoudig gevonden.',
  description: 'Vind lokale diensten in Uithoorn en De Kwakel of vertel ons wat je nodig hebt. Wij helpen je verder.',
  metadataBase: new URL('https://uithoorn.online'),
  icons: { icon: '/icon.svg', shortcut: '/icon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body><LocaleProvider>{children}<SpiceIndiaAd /></LocaleProvider></body></html>;
}
