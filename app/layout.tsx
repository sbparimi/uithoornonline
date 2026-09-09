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
import { LocaleProvider } from '../components/locale-provider';

export const metadata: Metadata = {
  title: 'Uithoorn.online — Vertel wat je nodig hebt. Wij regelen de rest.',
  description: 'Uithoorn.online is een AI-agent voor lokale taken. Eén gesprek begrijpt je intentie, schakelt de juiste specialist in en helpt je van vraag naar uitvoering in Uithoorn en De Kwakel.',
  metadataBase: new URL('https://uithoorn.online'),
  icons: { icon: '/icon.svg', shortcut: '/icon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body><LocaleProvider>{children}</LocaleProvider></body></html>;
}
