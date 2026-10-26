'use client';

import { usePathname } from 'next/navigation';
import { LOCALE_COOKIE, lp, stripLocale, type Locale } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';

function remember(locale: Locale) {
  try { document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`; } catch {}
}

export function LangSwitch({ className = '' }: { className?: string }) {
  const lang = useLang();
  const t = useDict();
  const base = stripLocale(usePathname() || '/');
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t.nav.language}>
      <a href={lp('nl', base)} hrefLang="nl" lang="nl" aria-current={lang === 'nl' ? 'true' : undefined} onClick={() => remember('nl')}>NL</a>
      <span aria-hidden="true">|</span>
      <a href={lp('en', base)} hrefLang="en" lang="en" aria-current={lang === 'en' ? 'true' : undefined} onClick={() => remember('en')}>EN</a>
    </div>
  );
}
