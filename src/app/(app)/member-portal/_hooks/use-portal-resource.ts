import { useCallback, useEffect, useState } from "react";
import type { ApiResource } from "@/hooks";
import { portalErrorText } from "../_lib/errors";

interface Outcome<T> {
  fetcher: () => Promise<T>;
  nonce: number;
  error: string | null;
}

/**
 * Loads one portal staff resource. Unlike `useApiResource`, a 404 is not
 * "not connected yet": the portal endpoints exist, so a 404 means another
 * branch's record (or a missing one) and a 403 a missing permission, and both
 * read in words. `fetcher` must be stable.
 */
export function usePortalResource<T>(fetcher: () => Promise<T>, enabled = true): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [outcome, setOutcome] = useState<Outcome<T> | null>(null);
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetcher()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setOutcome({ fetcher, nonce, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setOutcome({ fetcher, nonce, error: portalErrorText(err, "We couldn't load this. Please try again.") });
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, enabled, nonce]);

  const loading = enabled && !(outcome !== null && outcome.fetcher === fetcher && outcome.nonce === nonce);
  return { data, loading, unavailable: false, error: loading ? null : (outcome?.error ?? null), refetch };
}
