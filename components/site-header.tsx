'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { lp } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';
import { LangSwitch } from './lang-switch';

export type NavKey = 'businesses' | 'request' | 'forBusinesses' | 'deals' | null;

export function SiteHeader({ active = null }: { active?: NavKey }) {
  const lang = useLang();
  const t = useDict();
  const [open, setOpen] = useState(false);
  const links: [Exclude<NavKey, null>, string, string][] = [
    ['businesses', lp(lang, '/businesses'), t.nav.businesses],
    ['request', lp(lang, '/request'), t.nav.request],
    ['forBusinesses', lp(lang, '/voor-bedrijven'), t.nav.forBusinesses],
  ];
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href={lp(lang, '/')} className="site-brand" aria-label={t.common.homeAria}>
          <img src="/icon.svg" alt="" width={34} height={34} />
          <span>Uithoorn<span>.online</span></span>
        </a>
        <nav className="site-nav" aria-label={t.nav.main}>
          {links.map(([key, href, label]) => <a key={key} href={href} aria-current={active === key ? 'page' : undefined}>{label}</a>)}
        </nav>
        <div className="site-header-actions">
          <LangSwitch />
          <a className="site-login" href={lp(lang, '/login')}>{t.nav.login}</a>
          <a className="btn btn-primary btn-sm site-header-cta" href={lp(lang, '/request')}>{t.nav.request}</a>
          <button type="button" className="site-menu-button" onClick={() => setOpen((v) => !v)} aria-label={open ? t.nav.closeMenu : t.nav.openMenu} aria-expanded={open} aria-controls="site-mobile-nav">{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
        </div>
      </div>
      {open && (
        <nav id="site-mobile-nav" className="site-mobile-nav" aria-label={t.nav.mobile}>
          {links.map(([key, href, label]) => <a key={key} href={href} aria-current={active === key ? 'page' : undefined}>{label}</a>)}
          <a href={lp(lang, '/login')}>{t.nav.login}</a>
        </nav>
      )}
    </header>
  );
}
