'use client';
import { useEffect, useRef, useState } from 'react';
import { translations } from '../lib/i18n';
import { extraTranslations } from '../lib/i18n-extra';
import { pageTranslations } from '../lib/i18n-extra2';
import { homeTranslations } from '../lib/i18n-home';
import { discoveryTranslations } from '../lib/i18n-discovery';

type Locale = 'nl' | 'en';
const KEY = 'uithoorn-locale';
const allTranslations = { ...translations, ...extraTranslations, ...pageTranslations, ...homeTranslations, ...discoveryTranslations };

const nlToEn = Object.entries(allTranslations).filter(([nl, en]) => nl.trim() && en.trim() && nl !== en).sort(([a], [b]) => b.length - a.length);
const enToNl = Object.entries(allTranslations).filter(([nl, en]) => nl.trim() && en.trim() && nl !== en).sort(([nlA, enA], [nlB, enB]) => (enB.length - enA.length) || (nlB.length - nlA.length));
const originals = new WeakMap<Text, string>();
const lastRendered = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<HTMLElement, Record<string, string>>();
const lastRenderedAttributes = new WeakMap<HTMLElement, Record<string, string>>();
let translationQueued = false;

function isExcluded(el: Element | null) { return Boolean(el?.closest('[data-no-translate],script,style,svg')); }
function replacePairs(value: string, pairs: readonly (readonly [string, string])[]) { let result = value; for (const [from, to] of pairs) if (result.includes(from)) result = result.split(from).join(to); return result; }
function tx(value: string, locale: Locale) {
  if (!value.trim()) return value;
  if (locale === 'en') return replacePairs(value, nlToEn).replace(/(\d+) resultaten\b/g, '$1 results').replace(/(\d+) resultaat\b/g, '$1 result');
  return replacePairs(value, enToNl).replace(/(\d+) results\b/g, '$1 resultaten').replace(/(\d+) result\b/g, '$1 resultaat');
}
function translateDom(locale: Locale) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes: Text[] = []; let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  nodes.forEach((text) => { if (!text.parentElement || isExcluded(text.parentElement)) return; const current = text.nodeValue ?? ''; const previousOutput = lastRendered.get(text); const original = !originals.has(text) || (previousOutput !== undefined && current !== previousOutput) ? current : (originals.get(text) ?? current); originals.set(text, original); const translated = tx(original, locale); if (current !== translated) text.nodeValue = translated; lastRendered.set(text, translated); });
  document.querySelectorAll<HTMLElement>('[placeholder],[aria-label],[title]').forEach((el) => { if (isExcluded(el)) return; const attrs = originalAttributes.get(el) ?? {}; const rendered = lastRenderedAttributes.get(el) ?? {}; ['placeholder','aria-label','title'].forEach((attr) => { const current = el.getAttribute(attr); if (!current) return; const original = attrs[attr] === undefined || (rendered[attr] !== undefined && current !== rendered[attr]) ? current : attrs[attr]; attrs[attr] = original; const translated = tx(original, locale); if (current !== translated) el.setAttribute(attr, translated); rendered[attr] = translated; }); originalAttributes.set(el, attrs); lastRenderedAttributes.set(el, rendered); });
}
function queueTranslation(locale: Locale) { if (translationQueued) return; translationQueued = true; queueMicrotask(() => { translationQueued = false; translateDom(locale); }); }
function readSavedLocale(): Locale { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'nl'; } catch { return 'nl'; } }
function persistLocale(locale: Locale) { try { localStorage.setItem(KEY, locale); } catch {} document.cookie = `uithoorn-locale=${locale};path=/;max-age=31536000;samesite=lax`; }

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('nl'); const localeRef = useRef<Locale>('nl');
  useEffect(() => { const initial = readSavedLocale(); localeRef.current = initial; setLocale(initial); document.documentElement.lang = initial; document.body.classList.toggle('locale-en', initial === 'en'); translateDom(initial); const observer = new MutationObserver(() => queueTranslation(localeRef.current)); observer.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['placeholder','aria-label','title'] }); return () => observer.disconnect(); }, []);
  useEffect(() => { localeRef.current = locale; document.documentElement.lang = locale; document.body.classList.toggle('locale-en', locale === 'en'); persistLocale(locale); translateDom(locale); }, [locale]);
  function changeLocale(next: Locale) { localeRef.current = next; setLocale(next); document.documentElement.lang = next; document.body.classList.toggle('locale-en', next === 'en'); persistLocale(next); translateDom(next); }
  return <><div className="uo-locale-bar" aria-label="Language selector"><button className={locale === 'nl' ? 'active' : ''} onClick={() => changeLocale('nl')} aria-label="Nederlands" title="Nederlands">🇳🇱 <span>NL</span></button><button className={locale === 'en' ? 'active' : ''} onClick={() => changeLocale('en')} aria-label="English" title="English">🇬🇧 <span>EN</span></button></div>{children}</>;
}
