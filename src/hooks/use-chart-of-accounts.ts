import { useCallback } from "react";
import { accountingService } from "@/services";
import { templateAccounts } from "@/constants/chart-of-accounts";
import type { DrainResult } from "@/lib/paginate";
import type { Account } from "@/types";
import { useAccountingResource } from "./use-accounting-resource";

export interface ChartOfAccounts {
  accounts: Account[];
  /** Only the postable ones — never a group heading, never inactive. */
  postable: Account[];
  loading: boolean;
  /**
   * True when the drain gave up with pages outstanding, so `accounts` is
   * knowingly short. Every consumer of this hook is a PICKER, and a picker
   * missing rows presents as "that account does not exist" rather than as a
   * bug — so the forms have to say it out loud instead of rendering a
   * confident, incomplete dropdown.
   */
  truncated: boolean;
  /** `meta.total` when the server sent one, for the notice's "X of Y". */
  total: number | null;
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
  // Drained, not a single page. This used to be a bare `listAccounts()`, which
  // returned the endpoint's default 15 rows: the seeded template alone runs to
  // 60-odd accounts, so the expense and equity sections were absent from every
  // picker in the module and a journal against them could not be raised at all.
  const fetcher = useCallback(() => accountingService.accountsListAll(), []);
  const { data, loading, unavailable, error } =
    useAccountingResource<DrainResult<Account>>(fetcher);

  const isTemplate =
    unavailable || error !== null || (data?.rows.length ?? 0) === 0;
  const accounts = isTemplate ? templateAccounts() : data!.rows;

  return {
    accounts,
    postable: accounts.filter((a) => a.is_active && !a.is_group),
    loading,
    // The template is complete by definition, so a fallback chart is never
    // reported as short — that would blame the drain for the endpoint's absence.
    truncated: !isTemplate && (data?.truncated ?? false),
    total: isTemplate ? null : (data?.total ?? null),
    isTemplate,
  };
}
