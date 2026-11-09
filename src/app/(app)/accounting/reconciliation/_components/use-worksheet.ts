"use client";

import { useCallback, useEffect, useState } from "react";
import { reconciliationShow } from "../_lib/reconciliation-api";
import { loadFailure, type WorksheetState } from "../_lib/reconciliation-view";

interface Loaded {
  id: number;
  reloadCount: number;
  state: WorksheetState | null;
  error: string | null;
}

/**
 * One reconciliation's worksheet. It is read once, then replaced by what each
 * action or match answers (the same document GET answers), and read again only
 * on `reload()`, after a 409. While a reload runs the last worksheet stays on
 * screen.
 */
export function useWorksheet(id: number, canViewAll: boolean) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    reconciliationShow(id)
      .then((reconciliation) => {
        if (!cancelled) setLoaded({ id, reloadCount, state: { reconciliation, notice: null }, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoaded({ id, reloadCount, state: null, error: loadFailure(err, { canViewAll }) });
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadCount, canViewAll]);

  const replace = useCallback(
    (state: WorksheetState) => setLoaded({ id, reloadCount, state, error: null }),
    [id, reloadCount],
  );
  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  const mine = loaded !== null && loaded.id === id ? loaded : null;
  const settled = mine !== null && mine.reloadCount === reloadCount;

  return {
    state: mine?.state ?? null,
    error: settled ? mine.error : null,
    loading: !settled,
    replace,
    reload,
  };
}
