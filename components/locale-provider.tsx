'use client';
import { useEffect, useRef, useState } from 'react';
import { orderedTranslationKeys, translations } from '../lib/i18n';
import { extraTranslations } from '../lib/i18n-extra';

type Locale = 'nl' | 'en';
const KEY = 'uithoorn-locale';
const allTranslations = { ...translations, ...extraTranslations };
const allKeys = Object.keys(allTranslations).sort((a,b)=>b.length-a.length);
const originals = new WeakMap<Text, string>();
function tx(value: string, locale: Locale) {
  if (locale === 'nl') return value;
  let result = value;
  for (const key of allKeys) if (result.includes(key)) result = result.split(key).join(allTranslations[key]);
  return result.replace(/(\d+) resultaten\b/g, '$1 results').replace(/(\d+) resultaat\b/g, '$1 result');
}
function translateDom(locale: Locale) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = []; let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  nodes.forEach(text => { if (!text.parentElement || ['SCRIPT','STYLE'].includes(text.parentElement.tagName)) return; const original = originals.get(text) ?? text.nodeValue ?? ''; originals.set(text, original); text.nodeValue = tx(original, locale); });
  document.querySelectorAll<HTMLElement>('[placeholder],[aria-label],[title]').forEach(el => ['placeholder','aria-label','title'].forEach(attr => { const value = el.getAttribute(attr); if (!value) return; const key = `data-uo-original-${attr}`; const original = el.getAttribute(key) ?? value; el.setAttribute(key, original); el.setAttribute(attr, tx(original, locale)); }));
}
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('nl');
  const localeRef = useRef<Locale>('nl');
  useEffect(() => { const saved = (localStorage.getItem(KEY) as Locale | null) || 'nl'; localeRef.current = saved; setLocale(saved); document.documentElement.lang = saved; document.body.classList.toggle('locale-en', saved === 'en'); translateDom(saved); const observer = new MutationObserver(() => translateDom(localeRef.current)); observer.observe(document.body, { childList: true, subtree: true }); return () => observer.disconnect(); }, []);
  useEffect(() => { localeRef.current = locale; document.documentElement.lang = locale; document.body.classList.toggle('locale-en', locale === 'en'); localStorage.setItem(KEY, locale); document.cookie = `uithoorn-locale=${locale};path=/;max-age=31536000;samesite=lax`; translateDom(locale); }, [locale]);
  return <><div className="uo-locale-bar" aria-label="Language selector"><button className={locale === 'nl' ? 'active' : ''} onClick={() => setLocale('nl')} aria-label="Nederlands" title="Nederlands">🇳🇱 <span>NL</span></button><button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')} aria-label="English" title="English">🇬🇧 <span>EN</span></button></div>{children}</>;
}
