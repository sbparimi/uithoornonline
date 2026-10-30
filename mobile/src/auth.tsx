import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError, Me, setAuthToken, setUnauthorizedHandler } from './api';

const KEY = 'uo_session_token';

async function readToken() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}
async function writeToken(token: string | null) {
  if (Platform.OS === 'web') { if (token) globalThis.localStorage?.setItem(KEY, token); else globalThis.localStorage?.removeItem(KEY); return; }
  if (token) await SecureStore.setItemAsync(KEY, token); else await SecureStore.deleteItemAsync(KEY);
}

type Ctx = {
  ready: boolean;
  me: Me | null;
  refresh: () => Promise<Me | null>;
  login: (email: string, password: string, lang: string) => Promise<Me | null>;
  signup: (body: Record<string, unknown>) => Promise<Me | null>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const clear = useCallback(async () => { setAuthToken(null); setMe(null); await writeToken(null).catch(() => undefined); }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Me>('/api/mobile/me');
      setMe(data);
      return data;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await clear();
      return null;
    }
  }, [clear]);

  useEffect(() => {
    setUnauthorizedHandler(() => { clear(); });
    (async () => {
      const token = await readToken().catch(() => null);
      if (token) { setAuthToken(token); await refresh(); }
      setReady(true);
    })();
    return () => setUnauthorizedHandler(null);
  }, [clear, refresh]);

  const adopt = useCallback(async (token: string | undefined) => {
    if (!token) throw new ApiError('internal_error', 500);
    setAuthToken(token);
    await writeToken(token);
    return refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, lang: string) => {
    const res = await api<{ token?: string }>('/api/auth/login', { method: 'POST', body: { email: email.trim(), password, lang }, auth: false });
    return adopt(res.token);
  }, [adopt]);

  const signup = useCallback(async (body: Record<string, unknown>) => {
    const res = await api<{ token?: string }>('/api/auth/signup', { method: 'POST', body, auth: false });
    return adopt(res.token);
  }, [adopt]);

  const logout = useCallback(async () => {
    await api('/api/auth/signout', { method: 'POST' }).catch(() => undefined);
    await clear();
  }, [clear]);

  const value = useMemo(() => ({ ready, me, refresh, login, signup, logout }), [ready, me, refresh, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
