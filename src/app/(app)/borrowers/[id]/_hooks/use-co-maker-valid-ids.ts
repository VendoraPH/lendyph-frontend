"use client";

import { useCallback, useEffect, useState } from "react";
import { coMakerService, type CoMakerValidId } from "@/services/co-maker.service";
import { notifyError, notifySuccess } from "@/lib/notify";

export type ValidIdsStatus = "loading" | "ready" | "error";

/**
 * A co-maker's IDs on file, for the edit dialog: loaded when it opens, and
 * removable one at a time.
 *
 * Removing is immediate — its own action, as on the member's Documents tab —
 * not something Save does. Uploads never remove anything, so replacing an ID
 * is: remove the old one, add the new one.
 */
export function useCoMakerValidIds(coMakerId: number, enabled: boolean) {
  const [ids, setIds] = useState<CoMakerValidId[]>([]);
  const [status, setStatus] = useState<ValidIdsStatus>("loading");
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    coMakerService.listValidIds(coMakerId).then(
      (list) => {
        if (cancelled) return;
        setIds(Array.isArray(list) ? list : []);
        setStatus("ready");
      },
      () => {
        if (!cancelled) setStatus("error");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [coMakerId, enabled]);

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const list = await coMakerService.listValidIds(coMakerId);
      setIds(Array.isArray(list) ? list : []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [coMakerId]);

  /**
   * `onRemoved` runs once the ID is gone but before its row leaves the list —
   * the moment to move keyboard focus out of that row, while it still exists.
   */
  const remove = useCallback(
    async (validIdId: number, onRemoved?: () => void): Promise<boolean> => {
      setRemovingId(validIdId);
      try {
        await coMakerService.deleteValidId(coMakerId, validIdId);
      } catch (err) {
        // Already gone — removed in another tab, or a retry after a lost
        // response — is the outcome that was asked for.
        if (httpStatus(err) !== 404) {
          notifyError(err, "We couldn't remove the ID. Please try again.");
          setRemovingId(null);
          return false;
        }
      }
      onRemoved?.();
      setIds((current) => current.filter((entry) => entry.id !== validIdId));
      setRemovingId(null);
      notifySuccess("ID removed");
      return true;
    },
    [coMakerId]
  );

  return { ids, status, removingId, reload, remove };
}

// Structural, like api-error.ts: `instanceof AxiosError` breaks when axios is
// bundled twice.
function httpStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "response" in err) {
    return (err as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}
