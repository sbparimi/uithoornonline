'use client';

import { lp } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';
import { LangSwitch } from './lang-switch';

/** Header for signed-in pages: brand, a few links, language and sign-out. */
export function AppHeader({ links = [], signOut = true }: { links?: [string, string][]; signOut?: boolean }) {
  const lang = useLang();
  const t = useDict();
  return (
    <header className="site-header site-header-app">
      <div className="site-header-inner">
        <a href={lp(lang, '/')} className="site-brand" aria-label={t.common.homeAria}>
          <img src="/icon.svg" alt="" width={34} height={34} />
          <span>Uithoorn<span>.online</span></span>
        </a>
        <nav className="app-nav" aria-label={t.nav.main}>
          {links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <div className="site-header-actions">
          <LangSwitch />
          {signOut && <form action="/api/auth/signout" method="post"><button type="submit" className="btn btn-secondary btn-sm">{t.nav.logout}</button></form>}
        </div>
      </div>
    </header>
  );
}
