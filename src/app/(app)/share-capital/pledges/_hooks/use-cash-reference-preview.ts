"use client";

import { useEffect, useState } from "react";
import { shareCapitalService } from "@/services/share-capital.service";

/**
 * The server's next CSH reference number while a Cash entry form is open, or
 * null while loading or when the server has none (404/501 before the backend
 * lands). Bump `refreshKey` after a save so the preview moves on. It is only a
 * preview: the server assigns the real number when the entry saves.
 */
export function useCashReferencePreview(active: boolean, refreshKey: number): string | null {
  const [loaded, setLoaded] = useState<{ key: number; value: string | null } | null>(null);

  useEffect(() => {
    if (!active) return;
    let live = true;
    shareCapitalService
      .nextCashReference()
      .then((data) => {
        if (live) setLoaded({ key: refreshKey, value: data?.reference_number ?? null });
      })
      .catch(() => {
        if (live) setLoaded({ key: refreshKey, value: null });
      });
    return () => {
      live = false;
    };
  }, [active, refreshKey]);

  return active && loaded?.key === refreshKey ? loaded.value : null;
}
