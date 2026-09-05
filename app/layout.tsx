import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Uithoorn.online — Everything local. One place.',
  description: 'Discover local businesses, services, jobs, events and offers across Uithoorn and De Kwakel.',
  metadataBase: new URL('https://uithoorn.online'),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
