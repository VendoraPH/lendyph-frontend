import { useCallback, useEffect, useState } from "react";

export interface AccountingResource<T> {
  data: T | null;
  loading: boolean;
  /** `true` when the request failed because the endpoint does not exist yet. */
  unavailable: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches one accounting resource, distinguishing "this endpoint is not built
 * yet" from "this request failed".
 *
 * The distinction matters for the whole module right now: nothing under
 * `/accounting` exists, so every screen would otherwise show a red error and
 * read as broken. A 404 or 501 here means "not connected yet" and gets a
 * different, calmer treatment; a 403 or 500 is a real failure and says so.
 *
 * The moment the backend lands, none of the screens change — the same code
 * path simply starts returning rows.
 *
 * `fetcher` must be stable (wrap it in `useCallback` at the call site) or this
 * refetches on every render.
 */
export function useAccountingResource<T>(
  fetcher: () => Promise<T>,
  enabled = true,
): AccountingResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUnavailable(false);

    fetcher()
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404 || status === 501) {
          setUnavailable(true);
        } else {
          setError(
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message ?? "Unable to load this data.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetcher, enabled, nonce]);

  return { data, loading, unavailable, error, refetch };
}
