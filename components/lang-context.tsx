'use client';

import { createContext, useContext } from 'react';
import type { Locale } from '../lib/i18n/config';
import { getDictionary } from '../lib/i18n/dictionaries';

const LangContext = createContext<Locale>('nl');

export function LangProvider({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Locale {
  return useContext(LangContext);
}

export function useDict() {
  return getDictionary(useContext(LangContext));
}
