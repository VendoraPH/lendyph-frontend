import { useCallback, useEffect, useState } from "react";
import { borrowerService, type BorrowerValidId } from "@/services/borrower.service";

export type MemberValidIdsStatus = "loading" | "ready" | "error";

interface Loaded {
  key: string;
  ids: BorrowerValidId[];
  failed: boolean;
}

/**
 * The valid IDs a member has on file, read again on `reload()` (after an upload
 * that failed or may have stored, so the page shows what the server holds).
 * Loading is derived from whether the stored answer belongs to this request.
 */
export function useMemberValidIds(borrowerId: number) {
  const [reloadCount, setReloadCount] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${borrowerId}:${reloadCount}`;

  useEffect(() => {
    let active = true;
    borrowerService.listValidIds(borrowerId).then(
      (ids) => {
        if (active) setLoaded({ key, ids: Array.isArray(ids) ? ids : [], failed: false });
      },
      () => {
        if (active) setLoaded({ key, ids: [], failed: true });
      },
    );
    return () => {
      active = false;
    };
  }, [borrowerId, key]);

  const status: MemberValidIdsStatus = loaded?.key !== key ? "loading" : loaded.failed ? "error" : "ready";
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { ids: loaded?.ids ?? [], status, reload };
}
