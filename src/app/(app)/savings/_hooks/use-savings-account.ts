"use client";

import { useCallback } from "react";
import { useApiResource } from "@/hooks";
import { savingsAccountService } from "@/services/savings-account.service";

/**
 * One account with its product and balances. `account` is the loaded record
 * for the account chosen now, never a previous choice's (`useApiResource`
 * keeps its last data across requests).
 */
export function useSavingsAccount(accountId: number | null) {
  const fetcher = useCallback(
    () => (accountId === null ? Promise.resolve(null) : savingsAccountService.get(accountId)),
    [accountId],
  );
  const resource = useApiResource(fetcher, accountId !== null);
  const account =
    accountId !== null && !resource.loading && resource.data?.id === accountId ? resource.data : null;
  return { resource, account };
}
