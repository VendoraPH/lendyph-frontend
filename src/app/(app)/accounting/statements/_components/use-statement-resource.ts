"use client";

import { useCallback, useState } from "react";
import { useAccountingResource, type AccountingResource } from "@/hooks";
import { statementRefusal } from "../_lib/statement-request";

/**
 * A statement's request, plus the server's words when it refuses it (422).
 * `load` must be stable (wrap it in `useCallback`). A refusal belongs to the
 * request that drew it, so new filters, or a retry that succeeds, clear it.
 */
export function useStatementResource<T>(load: () => Promise<T>): {
  resource: AccountingResource<T>;
  refusal: string | null;
} {
  const [refused, setRefused] = useState<{ load: () => Promise<T>; message: string } | null>(null);

  const fetcher = useCallback(
    () =>
      load().catch((error: unknown) => {
        const message = statementRefusal(error);
        if (message !== null) setRefused({ load, message });
        throw error;
      }),
    [load],
  );
  const resource = useAccountingResource<T>(fetcher);

  const refusal =
    !resource.loading && resource.error !== null && refused?.load === load ? refused.message : null;
  return { resource, refusal };
}
