import { useCallback } from "react";
import { useApiResource, usePermission } from "@/hooks";
import { savingsService } from "@/services";

/**
 * Whether savings is set up in the books (`GET /savings/settings` →
 * `books_ready`), read only when `enabled` and the user may read the settings
 * (`savings:view` or `savings:settings`). `ready` is null when it wasn't or
 * couldn't be read; `canManage` is whether the user can fix it.
 */
export function useBooksReady(enabled: boolean): { ready: boolean | null; loading: boolean; canManage: boolean } {
  const { can } = usePermission();
  const canRead = can("savings:view") || can("savings:settings");
  const fetcher = useCallback(() => savingsService.settings(), []);
  const settings = useApiResource(fetcher, enabled && canRead);
  const ready = settings.data?.books_ready;
  return {
    ready: typeof ready === "boolean" ? ready : null,
    loading: enabled && canRead && settings.loading,
    canManage: can("savings:settings"),
  };
}
