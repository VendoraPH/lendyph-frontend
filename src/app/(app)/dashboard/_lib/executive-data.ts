/**
 * What the executive dashboard's sections loaded from the reports. Pure: the
 * hook fills `ExecutiveData`, the sections read it. The cards and the branch
 * table read the dashboard's own endpoints instead (`executive-overview.ts`).
 */

import type { Permission } from "@/types";
import type { AccountingDashboard } from "@/types/accounting";
import type {
  AgingReport,
  BorrowersReport,
  CashFlowReport,
  CollectionEfficiencyReport,
  DisbursementsReport,
  LoanBalanceSummaryReport,
  PerformanceReport,
  PortfolioByProductReport,
  ShareCapitalReport,
} from "@/types/dashboard-reports";

/**
 * One source's state. `denied` is a read the user lacks the permission for,
 * so it was never sent; `error` is a request that failed.
 */
export type Source<T> =
  | { state: "loading" }
  | { state: "ready"; data: T }
  | { state: "error" }
  | { state: "denied" };

export interface ExecutiveData {
  balance: Source<LoanBalanceSummaryReport>;
  aging: Source<AgingReport>;
  cashFlow: Source<CashFlowReport>;
  efficiency: Source<CollectionEfficiencyReport>;
  products: Source<PortfolioByProductReport>;
  performance: Source<PerformanceReport>;
  shareCapital: Source<ShareCapitalReport>;
  borrowers: Source<BorrowersReport>;
  disbursements: Source<DisbursementsReport>;
  accounting: Source<AccountingDashboard>;
  /** `meta.stats` of GET /loans: loan counts per status. */
  loanStats: Source<Record<string, number>>;
}

export type SourceKey = keyof ExecutiveData;

/**
 * What each source needs before it is requested. A user missing any of them
 * never sends the request, and the source reads "No access". Share capital
 * also needs share_capital:view, as the Dashboard's own Share Capital card does.
 */
export const SOURCE_PERMISSIONS: Record<SourceKey, Permission[]> = {
  balance: ["reports:view"],
  aging: ["reports:view"],
  cashFlow: ["reports:view"],
  efficiency: ["reports:view"],
  products: ["reports:view"],
  performance: ["reports:view"],
  shareCapital: ["reports:view", "share_capital:view"],
  borrowers: ["reports:view"],
  disbursements: ["reports:view"],
  accounting: ["accounting:view"],
  loanStats: ["loans:view"],
};

/** Whether every permission a source needs is held; a source that isn't is never requested and reads "No access". */
export function sourcePermitted(name: SourceKey, allowed: ReadonlySet<string>): boolean {
  return SOURCE_PERMISSIONS[name].every((p) => allowed.has(p));
}

export const LOADING: Source<never> = { state: "loading" };

/** The payload when it arrived, else `null`. */
export function readyData<T>(source: Source<T>): T | null {
  return source.state === "ready" ? source.data : null;
}

/** Centavos (the accounting API) to pesos. */
export const fromCentavos = (centavos: number | null | undefined): number | null =>
  typeof centavos === "number" && Number.isFinite(centavos) ? centavos / 100 : null;
