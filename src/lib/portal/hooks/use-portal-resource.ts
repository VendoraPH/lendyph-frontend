import { useCallback, useEffect, useState } from "react";
import { portalErrorMessage } from "@/lib/portal/errors";

export interface PortalResource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface Outcome<T> {
  fetcher: () => Promise<T>;
  nonce: number;
  data: T | null;
  error: string | null;
}

/**
 * One portal read: loading, then the server's data or its refusal in words.
 * Unlike the staff `useApiResource`, a 404 here is a real answer ("not yours,
 * or gone"), never "not connected yet". `fetcher` must be stable.
 */
export function usePortalResource<T>(fetcher: () => Promise<T>, failure: string, enabled = true): PortalResource<T> {
  const [outcome, setOutcome] = useState<Outcome<T> | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setOutcome({ fetcher, nonce, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setOutcome({ fetcher, nonce, data: null, error: portalErrorMessage(err, failure) });
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, nonce, failure, enabled]);

  const settled = outcome !== null && outcome.fetcher === fetcher && outcome.nonce === nonce;
  const loading = enabled && !settled;
  return {
    data: settled ? outcome.data : null,
    loading,
    error: settled ? outcome.error : null,
    reload,
  };
}
