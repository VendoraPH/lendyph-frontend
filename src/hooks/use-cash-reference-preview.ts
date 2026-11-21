"use client";

import { useEffect, useState } from "react";

/** A service call answering the next number of one cash reference series. */
export type CashReferenceFetcher = () => Promise<{ reference_number?: string | null } | null | undefined>;

/**
 * The server's next cash reference number while a Cash form is open, or null
 * while loading or when the server has none (404/501 before the backend
 * lands). Bump `refreshKey` after a save so the preview moves on. It is only a
 * preview: the server assigns the real number when the record saves. Pass a
 * stable `fetcher` (a service method, not an inline arrow).
 */
export function useCashReferencePreview(
  fetcher: CashReferenceFetcher,
  active: boolean,
  refreshKey: number,
): string | null {
  const [loaded, setLoaded] = useState<{ key: number; value: string | null } | null>(null);

  useEffect(() => {
    if (!active) return;
    let live = true;
    fetcher()
      .then((data) => {
        if (live) setLoaded({ key: refreshKey, value: data?.reference_number ?? null });
      })
      .catch(() => {
        if (live) setLoaded({ key: refreshKey, value: null });
      });
    return () => {
      live = false;
    };
  }, [fetcher, active, refreshKey]);

  return active && loaded?.key === refreshKey ? loaded.value : null;
}
