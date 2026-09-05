import type { Metadata } from 'next';
import './globals.css';
import './uo.css';

export const metadata: Metadata = {
  title: 'Uithoorn.online — Vind iets lokaal.',
  description: 'Ontdek lokale diensten, workshops en Indian food in Uithoorn en De Kwakel.',
  metadataBase: new URL('https://uithoorn.online'),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
