import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Meta } from './api';
import fallback from './meta-fallback.json';

const KEY = 'uo-meta-v1';
const MetaContext = createContext<Meta>(fallback as Meta);

// Option lists come from the website (/api/mobile/meta) so categories never drift; a bundled
// copy covers the first launch offline.
export function MetaProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<Meta>(fallback as Meta);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setMeta(JSON.parse(v)); }).catch(() => undefined);
    api<Meta>('/api/mobile/meta', { auth: false }).then((m) => {
      if (m?.businessCategories?.length) { setMeta(m); AsyncStorage.setItem(KEY, JSON.stringify(m)).catch(() => undefined); }
    }).catch(() => undefined);
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);
