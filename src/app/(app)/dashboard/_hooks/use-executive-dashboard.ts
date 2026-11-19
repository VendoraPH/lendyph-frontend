import { useEffect, useState } from "react";
import { usePermission } from "@/hooks";
import { accountingService, loanService, reportService } from "@/services";
import type { Permission } from "@/types";
import type { ExecutiveFilters as ExecutivePageFilters } from "@/types/executive-dashboard";
import { LOADING, SOURCE_PERMISSIONS, sourcePermitted, type ExecutiveData, type Source, type SourceKey } from "../_lib/executive-data";

/** A date range the server worked out (`DashboardPeriod`), as YYYY-MM-DD in Manila. */
export interface ServerRange {
  from: string;
  to: string;
}

export interface ExecutiveFilters {
  /** The server's period; null until the overview has answered, or when it failed. */
  period: ServerRange | null;
  /** `undefined` for every branch the user may see. */
  branchId?: number;
  /** The page filters (product, officer, collector): the reports take them through EB-A's loan scope. */
  pageFilters?: PageFilters;
}


type Load = () => Promise<unknown>;
type PageFilters = ExecutivePageFilters;

/**
 * Every read the dashboard makes, by source; each needs the permissions in
 * `SOURCE_PERMISSIONS`. Balances (loan balance summary, products,
 * performance, past due, aging) take no dates: the server dates
 * them to today. A past as-of date is never sent ("No backfill"): for a past
 * period the sections show "No snapshot for this date" instead. The rest cover
 * the period.
 */
function requests({
  period,
  branchId,
  pageFilters = {},
}: {
  period: ServerRange;
  branchId?: number;
  pageFilters?: PageFilters;
}): Partial<Record<SourceKey, Load>> {
  // The reports follow the branch and the page filters; the accounting
  // dashboard and the loan counts take the branch only.
  const branch = { ...(branchId ? { branch_id: branchId } : {}), ...pageFilters };
  const range = { ...branch, date_from: period.from, date_to: period.to };

  return {
    balance: () => reportService.loanBalanceSummary(branch),
    aging: () => reportService.aging(branch),
    cashFlow: () => reportService.cashFlow(range),
    efficiency: () => reportService.collectionEfficiency(range),
    products: () => reportService.portfolioByProduct(branch),
    performance: () => reportService.performance(range),
    shareCapital: () => reportService.shareCapital(range),
    borrowers: () => reportService.borrowers(range),
    disbursements: () => reportService.disbursements(range),
    accounting: () => accountingService.dashboard(period.to, branchId, period.from),
    // One row asked for: only `meta.stats` (counts per status) is read.
    loanStats: () =>
      loanService.list({ ...(branchId ? { branch_id: branchId } : {}), per_page: 1 }).then((res) => {
        const stats = res?.meta?.stats;
        if (!stats) throw new Error("no stats");
        return stats;
      }),
  };
}

const SOURCE_KEYS: SourceKey[] = [
  "balance",
  "aging",
  "cashFlow",
  "efficiency",
  "products",
  "performance",
  "shareCapital",
  "borrowers",
  "disbursements",
  "accounting",
  "loanStats",
];

const PERMISSIONS: Permission[] = [...new Set(Object.values(SOURCE_PERMISSIONS).flat())];

/**
 * Loads the executive dashboard's sources in parallel, each on its own, so a
 * slow or failed report leaves the rest of the page standing. A source the
 * user lacks the permission for is never requested and reads `denied`.
 * Nothing loads until the server has worked out the period (`period` null):
 * then every source reads loading, or `error` when the period failed.
 *
 * Results are stored with the request they answer, so a figure for an old
 * filter is never shown under a new one.
 */
export function useExecutiveDashboard(filters: ExecutiveFilters, reloadCount: number, periodFailed = false): ExecutiveData {
  const { can } = usePermission();
  // The permissions as one string, so the effect re-runs only when one changes.
  const granted = PERMISSIONS.filter((p) => can(p)).join(",");
  const from = filters.period?.from ?? "";
  const to = filters.period?.to ?? "";
  const branchId = filters.branchId;
  const pageFilters = JSON.stringify(filters.pageFilters ?? {});
  const key = [from, to, branchId ?? "all", pageFilters, reloadCount, granted].join("|");
  const [stored, setStored] = useState<{ key: string; data: Partial<ExecutiveData> }>({ key: "", data: {} });

  useEffect(() => {
    if (!from || !to) return;
    const allowed = new Set(granted.split(","));
    const table = requests({ period: { from, to }, branchId, pageFilters: JSON.parse(pageFilters) });
    const settle = (name: SourceKey, source: Source<unknown>) =>
      setStored((prev) => ({ key, data: { ...(prev.key === key ? prev.data : {}), [name]: source } }));

    for (const name of SOURCE_KEYS) {
      const load = table[name];
      if (!load || !sourcePermitted(name, allowed)) continue;
      load()
        .then((data) => settle(name, data && typeof data === "object" ? { state: "ready", data } : { state: "error" }))
        .catch(() => settle(name, { state: "error" }));
    }
  }, [key, from, to, branchId, pageFilters, granted]);

  if (!from || !to) {
    const waiting = periodFailed ? ({ state: "error" } as const) : LOADING;
    return Object.fromEntries(SOURCE_KEYS.map((name) => [name, waiting])) as unknown as ExecutiveData;
  }
  const loaded = stored.key === key ? stored.data : {};
  const allowed = new Set(granted.split(","));
  const table = requests({ period: { from, to }, branchId, pageFilters: filters.pageFilters });
  const result = {} as Record<SourceKey, Source<unknown>>;
  for (const name of SOURCE_KEYS) {
    result[name] =
      loaded[name] ?? (!table[name] ? { state: "error" } : sourcePermitted(name, allowed) ? LOADING : { state: "denied" });
  }
  return result as ExecutiveData;
}
