import { useEffect, useState } from "react";
import { usePermission } from "@/hooks";
import { accountingService, loanService, reportService } from "@/services";
import type { Permission } from "@/types";
import type { PastDueTotals } from "@/types/dashboard-reports";
import { LOADING, SOURCE_PERMISSIONS, type ExecutiveData, type Source, type SourceKey } from "../_lib/executive-data";
import { previousPeriod, type Period } from "../_lib/periods";

export interface ExecutiveFilters {
  period: Period;
  /** `undefined` for every branch the user may see. */
  branchId?: number;
}


type Load = () => Promise<unknown>;

/**
 * Every read the dashboard makes, by source; each needs the permissions in
 * `SOURCE_PERMISSIONS`. Balances (loan balance summary, products,
 * performance, past due) take no dates: the server dates them to today, and a
 * date range there would filter by release date instead. Aging and
 * provisioning are as of the period's last day; the rest cover the period.
 */
function requests({ period, branchId }: ExecutiveFilters): Partial<Record<SourceKey, Load>> {
  const branch = branchId ? { branch_id: branchId } : {};
  const range = { ...branch, date_from: period.from, date_to: period.to };
  const prev = previousPeriod(period);
  const prevRange = prev ? { ...branch, date_from: prev.from, date_to: prev.to } : null;

  return {
    balance: () => reportService.loanBalanceSummary(branch),
    aging: () => reportService.aging({ ...branch, as_of_date: period.to }),
    cashFlow: () => reportService.cashFlow(range),
    efficiency: () => reportService.collectionEfficiency(range),
    products: () => reportService.portfolioByProduct(branch),
    performance: () => reportService.performance(range),
    provisioning: () => reportService.provisioning({ ...branch, as_of_date: period.to }),
    shareCapital: () => reportService.shareCapital(range),
    income: () => reportService.income(range),
    borrowers: () => reportService.borrowers(range),
    disbursements: () => reportService.disbursements(range),
    ...(prevRange && {
      prevCashFlow: () => reportService.cashFlow(prevRange),
      prevEfficiency: () => reportService.collectionEfficiency(prevRange),
    }),
    accounting: () => accountingService.dashboard(period.to, branchId, period.from),
    // One row asked for: only `meta.stats` (counts per status) is read.
    loanStats: () =>
      loanService.list({ ...branch, per_page: 1 }).then((res) => {
        const stats = res?.meta?.stats;
        if (!stats) throw new Error("no stats");
        return stats;
      }),
    // The Past Due Loans page's cards: past grace, each loan once. One row asked for: only `totals` is read.
    pastDue: () =>
      reportService
        .duePastDue({ ...branch, past_due_only: 1, per_page: 1 })
        .then((res) => {
          const totals = (res as { totals?: PastDueTotals } | null)?.totals;
          if (!totals) throw new Error("no totals");
          return totals;
        }),
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
  "accounting",
  "loanStats",
  "pastDue",
];

const PERMISSIONS: Permission[] = [...new Set(Object.values(SOURCE_PERMISSIONS).flat())];
const permitted = (name: SourceKey, allowed: Set<string>) => SOURCE_PERMISSIONS[name].every((p) => allowed.has(p));

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
      const load = table[name];
      if (!load || !permitted(name, allowed)) continue;
      load()
        .then((data) => settle(name, data && typeof data === "object" ? { state: "ready", data } : { state: "error" }))
        .catch(() => settle(name, { state: "error" }));
    }
  }, [key, from, to, branchId, granted]);

  const loaded = stored.key === key ? stored.data : {};
  const allowed = new Set(granted.split(","));
  const table = requests({ period: { from, to }, branchId });
  const result = {} as Record<SourceKey, Source<unknown>>;
  for (const name of SOURCE_KEYS) {
    result[name] =
      loaded[name] ?? (!table[name] ? { state: "error" } : permitted(name, allowed) ? LOADING : { state: "denied" });
  }
  return result as ExecutiveData;
}
