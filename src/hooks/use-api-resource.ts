import { useCallback, useEffect, useState } from "react";

export interface ApiResource<T> {
  data: T | null;
  loading: boolean;
  /** `true` when the request failed because the endpoint does not exist yet. */
  unavailable: boolean;
  error: string | null;
  refetch: () => void;
}

/** How the request made for one fetcher and refetch count ended. */
interface Outcome<T> {
  fetcher: () => Promise<T>;
  nonce: number;
  unavailable: boolean;
  error: string | null;
}

/**
 * Fetches one resource, distinguishing "this endpoint is not built yet" from
 * "this request failed".
 *
 * The distinction matters for modules that are UI-shell-only right now:
 * nothing on the backend exists yet, so every screen would otherwise show a
 * red error and read as broken. A 404 or 501 here means "not connected yet"
 * and gets a different, calmer treatment; a 403 or 500 is a real failure and
 * says so.
 *
 * The moment the backend lands, none of the screens change — the same code
 * path simply starts returning rows.
 *
 * `fetcher` must be stable (wrap it in `useCallback` at the call site) or this
 * refetches on every render.
 */
export function useApiResource<T>(
  fetcher: () => Promise<T>,
  enabled = true,
): ApiResource<T> {
  // `data` is the last successful response and outlives later requests, so a
  // refetch or a failure never blanks what was already loaded.
  const [data, setData] = useState<T | null>(null);
  const [outcome, setOutcome] = useState<Outcome<T> | null>(null);
  const [nonce, setNonce] = useState(0);

  // Switching the hook off and on again requests afresh even for the same
  // fetcher, so forget the last outcome whenever `enabled` flips.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    setOutcome(null);
  }

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    fetcher()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setOutcome({ fetcher, nonce, unavailable: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        const notBuilt = status === 404 || status === 501;
        setOutcome({
          fetcher,
          nonce,
          unavailable: notBuilt,
          error: notBuilt
            ? null
            : ((err as { response?: { data?: { message?: string } } })?.response?.data
                ?.message ?? "Unable to load this data."),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fetcher, enabled, nonce]);

  // Loading until the request for the current fetcher and refetch count has
  // settled — derived, so the render that asks for new data already says so.
  const settled =
    outcome !== null && outcome.fetcher === fetcher && outcome.nonce === nonce;
  const loading = enabled && !settled;

  return {
    data,
    loading,
    unavailable: !loading && (outcome?.unavailable ?? false),
    error: loading ? null : (outcome?.error ?? null),
    refetch,
  };
}
