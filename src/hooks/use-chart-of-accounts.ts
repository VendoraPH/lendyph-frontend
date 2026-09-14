import { useCallback } from "react";
import { accountingService } from "@/services";
import { templateAccounts } from "@/constants/chart-of-accounts";
import type { Account } from "@/types";
import { useAccountingResource } from "./use-accounting-resource";

export interface ChartOfAccounts {
  accounts: Account[];
  /** Only the postable ones — never a group heading, never inactive. */
  postable: Account[];
  loading: boolean;
  /**
   * True when these are the seeded default rows rather than the organisation's
   * own saved chart, which is the case until the accounts endpoint exists.
   * Every form that writes must check this and refuse: the ids are positional
   * placeholders, so posting against them would reference accounts that do not
   * exist on the server.
   */
  isTemplate: boolean;
}

/**
 * The chart of accounts, for every picker in the module.
 *
 * Falls back to the default template when the endpoint is not there yet, so
 * the forms are usable and reviewable rather than a page of empty dropdowns —
 * but says so via `isTemplate`, and the forms disable submission on it.
 */
export function useChartOfAccounts(): ChartOfAccounts {
  const fetcher = useCallback(() => accountingService.listAccounts(), []);
  const { data, loading, unavailable, error } = useAccountingResource<Account[]>(fetcher);

  const isTemplate = unavailable || error !== null || (data?.length ?? 0) === 0;
  const accounts = isTemplate ? templateAccounts() : (data as Account[]);

  return {
    accounts,
    postable: accounts.filter((a) => a.is_active && !a.is_group),
    loading,
    isTemplate,
  };
}
