import { useEffect, useState } from "react";
import { usePermission } from "@/hooks";
import { accountingService, loanService, reportService } from "@/services";
import type { Permission } from "@/types";
import { LOADING, type ExecutiveData, type Source, type SourceKey } from "../_lib/executive-data";
import { previousPeriod, type Period } from "../_lib/periods";

export interface ExecutiveFilters {
  period: Period;
  /** `undefined` for every branch the user may see. */
  branchId?: number;
}

interface Request {
  permission: Permission;
  load: () => Promise<unknown>;
}

/**
 * Every read the dashboard makes, by source. Balances (loan balance summary,
 * products, performance) take no dates: the server dates them to today, and a
 * date range there would filter by release date instead. Aging and
 * provisioning are as of the period's last day; the rest cover the period.
 */
function requests({ period, branchId }: ExecutiveFilters): Partial<Record<SourceKey, Request>> {
  const branch = branchId ? { branch_id: branchId } : {};
  const range = { ...branch, date_from: period.from, date_to: period.to };
  const prev = previousPeriod(period);
  const prevRange = prev ? { ...branch, date_from: prev.from, date_to: prev.to } : null;
  const report = (load: () => Promise<unknown>): Request => ({ permission: "reports:view", load });

  return {
    balance: report(() => reportService.loanBalanceSummary(branch)),
    aging: report(() => reportService.aging({ ...branch, as_of_date: period.to })),
    cashFlow: report(() => reportService.cashFlow(range)),
    efficiency: report(() => reportService.collectionEfficiency(range)),
    products: report(() => reportService.portfolioByProduct(branch)),
    performance: report(() => reportService.performance(range)),
    provisioning: report(() => reportService.provisioning({ ...branch, as_of_date: period.to })),
    shareCapital: report(() => reportService.shareCapital(range)),
    income: report(() => reportService.income(range)),
    borrowers: report(() => reportService.borrowers(range)),
    disbursements: report(() => reportService.disbursements(range)),
    ...(prevRange && {
      prevCashFlow: report(() => reportService.cashFlow(prevRange)),
      prevEfficiency: report(() => reportService.collectionEfficiency(prevRange)),
      prevDisbursements: report(() => reportService.disbursements(prevRange)),
    }),
    accounting: {
      permission: "accounting:view",
      load: () => accountingService.dashboard(period.to, branchId, period.from),
    },
    loanStats: {
      permission: "loans:view",
      // One row asked for: only `meta.stats` (counts per status) is read.
      load: () =>
        loanService.list({ ...branch, per_page: 1 }).then((res) => {
          const stats = res?.meta?.stats;
          if (!stats) throw new Error("no stats");
          return stats;
        }),
    },
  };
}

const SOURCE_KEYS: SourceKey[] = [
  "balance",
  "aging",
  "cashFlow",
  "prevCashFlow",
  "efficiency",
  "prevEfficiency",
  "products",
  "performance",
  "provisioning",
  "shareCapital",
  "income",
  "borrowers",
  "disbursements",
  "prevDisbursements",
  "accounting",
  "loanStats",
];

const PERMISSIONS: Permission[] = ["reports:view", "accounting:view", "loans:view"];

/**
 * Loads the executive dashboard's sources in parallel, each on its own, so a
 * slow or failed report leaves the rest of the page standing. A source the
 * user lacks the permission for is never requested and reads `denied`; a
 * comparison with no previous period reads `error` (no comparison shown).
 *
 * Results are stored with the request they answer, so a figure for an old
 * filter is never shown under a new one.
 */
export function useExecutiveDashboard(filters: ExecutiveFilters, reloadCount: number): ExecutiveData {
  const { can } = usePermission();
  // The permissions as one string, so the effect re-runs only when one changes.
  const granted = PERMISSIONS.filter((p) => can(p)).join(",");
  const { from, to } = filters.period;
  const branchId = filters.branchId;
  const key = [from, to, branchId ?? "all", reloadCount, granted].join("|");
  const [stored, setStored] = useState<{ key: string; data: Partial<ExecutiveData> }>({ key: "", data: {} });

  useEffect(() => {
    const allowed = new Set(granted.split(","));
    const table = requests({ period: { from, to }, branchId });
    const settle = (name: SourceKey, source: Source<unknown>) =>
      setStored((prev) => ({ key, data: { ...(prev.key === key ? prev.data : {}), [name]: source } }));

    for (const name of SOURCE_KEYS) {
      const request = table[name];
      if (!request || !allowed.has(request.permission)) continue;
      request
        .load()
        .then((data) => settle(name, data && typeof data === "object" ? { state: "ready", data } : { state: "error" }))
        .catch(() => settle(name, { state: "error" }));
    }
  }, [key, from, to, branchId, granted]);

  const loaded = stored.key === key ? stored.data : {};
  const allowed = new Set(granted.split(","));
  const table = requests({ period: { from, to }, branchId });
  const result = {} as Record<SourceKey, Source<unknown>>;
  for (const name of SOURCE_KEYS) {
    const request = table[name];
    result[name] =
      loaded[name] ?? (!request ? { state: "error" } : allowed.has(request.permission) ? LOADING : { state: "denied" });
  }
  return result as ExecutiveData;
}
