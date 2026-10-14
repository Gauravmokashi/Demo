'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiJson, UnauthorizedError } from './api';

type Options = {
  onUnauthorized: () => void;
  fallbackMessage: string;
  /** Delay before fetching, so typing in a search box sends one request instead of one per key. */
  debounceMs?: number;
};

/** Fetches JSON for `path` (null = don't fetch), cancelling stale requests when the path changes. */
export function useApiData<T>(path: string | null, { onUnauthorized, fallbackMessage, debounceMs = 0 }: Options) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(path));
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      apiJson<T>(path, { signal: controller.signal, fallbackMessage })
        .then((result) => {
          setData(result);
          setError('');
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          if (reason instanceof UnauthorizedError) onUnauthorized();
          else setError(reason instanceof Error ? reason.message : fallbackMessage);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [path, version, debounceMs, fallbackMessage, onUnauthorized]);

  return { data, error, loading, reload, clearError: () => setError('') };
}
