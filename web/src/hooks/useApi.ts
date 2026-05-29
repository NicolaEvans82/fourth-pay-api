import { useCallback, useEffect, useState } from 'react';
import { usePersona } from './usePersona';

export const API_BASE = 'https://fourth-pay-api-production.up.railway.app';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Hook that fetches a JSON endpoint with the persona auth headers.
// `refreshKey` lets the caller invalidate (e.g. after a POST). The
// hook re-fetches automatically when the persona changes, since
// `headers` is a stable reference per persona.
export function useApi<T>(
  path: string,
  refreshKey: number = 0,
): FetchState<T> & { refetch: () => void } {
  const { headers } = usePersona();
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [bump, setBump] = useState(0);

  const refetch = useCallback(() => setBump((b) => b + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fetch(API_BASE + path, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return (await res.json()) as T;
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.warn('useApi fetch failed for ' + path + ':', err);
          setState({ data: null, loading: false, error: String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, headers, refreshKey, bump]);

  return { ...state, refetch };
}

// One-shot fetch helper that goes through the same persona headers
// pipeline. Use for actions (POST/PUT) — for reads, prefer useApi.
export function useApiClient() {
  const { headers } = usePersona();
  const request = useCallback(
    async <T,>(
      method: 'POST' | 'PUT',
      path: string,
      body: unknown,
    ): Promise<{ ok: boolean; data?: T; error?: string; status: number }> => {
      try {
        const res = await fetch(API_BASE + path, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          let msg = 'HTTP ' + res.status;
          try {
            const j = await res.json();
            if (j && j.message) msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
          } catch {}
          return { ok: false, error: msg, status: res.status };
        }
        const data = (await res.json()) as T;
        return { ok: true, data, status: res.status };
      } catch (err) {
        return { ok: false, error: String(err), status: 0 };
      }
    },
    [headers],
  );
  return request;
}
