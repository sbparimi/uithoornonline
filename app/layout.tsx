import type { Metadata } from 'next';
import './globals.css';
import './uo.css';
import './speakin-theme.css';
import './uopages.css';
import './locale.css';
import { LocaleProvider } from '../components/locale-provider';

export const metadata: Metadata = {
  title: 'Uithoorn.online — Vind iets lokaal.',
  description: 'Ontdek lokale diensten, workshops en Indian food in Uithoorn en De Kwakel.',
  metadataBase: new URL('https://uithoorn.online'),
  icons: { icon: '/icon.svg', shortcut: '/icon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body><LocaleProvider>{children}</LocaleProvider></body></html>;
}
