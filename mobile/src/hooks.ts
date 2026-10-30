import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api, ApiError } from './api';

export function useApi<T>(path: string | null, opts: { refocus?: boolean } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (!path) return;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const d = await api<T>(path);
      if (mounted.current) { setData(d); setError(null); }
    } catch (e) {
      if (mounted.current) setError(e instanceof ApiError ? e.code : 'error');
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, [path]);
  useEffect(() => { load('initial'); }, [load]);
  useFocusEffect(useCallback(() => { if (opts.refocus && data) load('silent'); }, [opts.refocus, load])); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, refreshing, reload: () => load('refresh'), silent: () => load('silent'), setData };
}
