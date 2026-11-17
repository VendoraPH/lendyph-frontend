/**
 * What the executive dashboard loaded, and the figures its cards show. Pure:
 * the hook fills `ExecutiveData`, everything here reads it.
 */

import type { AccountingDashboard } from "@/types/accounting";
import type {
  AgingReport,
  BorrowersReport,
  CashFlowReport,
  CollectionEfficiencyReport,
  DisbursementsReport,
  IncomeReport,
  LoanBalanceSummaryReport,
  PerformanceReport,
  PortfolioByProductReport,
  ProvisioningReport,
  ShareCapitalReport,
} from "@/types/dashboard-reports";
import { OVERVIEW_METRICS, percentChange, pointChange, sumKnown, toNumber, type MetricId } from "./metrics";

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
  prevCashFlow: Source<CashFlowReport>;
  efficiency: Source<CollectionEfficiencyReport>;
  prevEfficiency: Source<CollectionEfficiencyReport>;
  products: Source<PortfolioByProductReport>;
  performance: Source<PerformanceReport>;
  provisioning: Source<ProvisioningReport>;
  shareCapital: Source<ShareCapitalReport>;
  income: Source<IncomeReport>;
  borrowers: Source<BorrowersReport>;
  disbursements: Source<DisbursementsReport>;
  prevDisbursements: Source<DisbursementsReport>;
  accounting: Source<AccountingDashboard>;
  /** `meta.stats` of GET /loans: loan counts per status. */
  loanStats: Source<Record<string, number>>;
}

export type SourceKey = keyof ExecutiveData;

export const LOADING: Source<never> = { state: "loading" };

/** The payload when it arrived, else `null`. */
export function readyData<T>(source: Source<T>): T | null {
  return source.state === "ready" ? source.data : null;
}

/** A card's state: what to show when there is no figure. */
export type KpiState = "loading" | "ready" | "unavailable" | "denied";

export interface KpiView {
  id: MetricId;
  value: number | null;
  /** Percent, or points for a ratio; `null` when there is no comparison. */
  change: number | null;
  /** What the change is measured against, for the card's caption. */
  changeBasis: "previous_period" | "opening_balance" | null;
  state: KpiState;
}

/** Which source each card reads, for its loading and permission state. */
const KPI_SOURCE: Record<MetricId, SourceKey> = {
  outstanding_principal: "balance",
  outstanding_balance: "balance",
  active_loans: "balance",
  active_borrowers: "borrowers",
  loans_released: "disbursements",
  collections: "cashFlow",
  collection_rate: "efficiency",
  par30: "balance",
  past_due_amount: "balance",
  required_allowance: "provisioning",
  share_capital: "shareCapital",
  net_income: "accounting",
};

/** Centavos (the accounting API) to pesos. */
export const fromCentavos = (centavos: number | null | undefined): number | null =>
  typeof centavos === "number" && Number.isFinite(centavos) ? centavos / 100 : null;

function kpiValue(id: MetricId, d: ExecutiveData): { value: number | null; change: number | null } {
  const balance = readyData(d.balance);
  switch (id) {
    case "outstanding_principal":
      return { value: toNumber(balance?.outstanding?.principal), change: null };
    case "outstanding_balance":
      return { value: toNumber(balance?.outstanding?.balance), change: null };
    case "active_loans":
      return { value: toNumber(balance?.active_loans ?? balance?.portfolio?.active_loan_count), change: null };
    case "active_borrowers":
      return { value: toNumber(readyData(d.borrowers)?.total_active_borrowers), change: null };
    case "loans_released": {
      const value = toNumber(readyData(d.disbursements)?.total_disbursed);
      return { value, change: percentChange(value, toNumber(readyData(d.prevDisbursements)?.total_disbursed)) };
    }
    case "collections": {
      const value = toNumber(readyData(d.cashFlow)?.inflows?.repayments?.total);
      return { value, change: percentChange(value, toNumber(readyData(d.prevCashFlow)?.inflows?.repayments?.total)) };
    }
    case "collection_rate": {
      const value = toNumber(readyData(d.efficiency)?.collection_rate);
      return { value, change: pointChange(value, toNumber(readyData(d.prevEfficiency)?.collection_rate)) };
    }
    case "par30":
      return { value: toNumber(balance?.par_ratio), change: null };
    case "past_due_amount":
      return {
        value: balance?.overdue
          ? sumKnown(balance.overdue.principal, balance.overdue.interest, balance.overdue.penalty)
          : null,
        change: null,
      };
    case "required_allowance":
      return { value: toNumber(readyData(d.provisioning)?.totals?.required_allowance), change: null };
    case "share_capital": {
      const sc = readyData(d.shareCapital);
      const value = toNumber(sc?.closing_balance);
      return { value, change: percentChange(value, toNumber(sc?.opening_balance)) };
    }
    case "net_income":
      return { value: fromCentavos(readyData(d.accounting)?.period?.net_income), change: null };
  }
}

function changeBasis(id: MetricId): KpiView["changeBasis"] {
  if (id === "share_capital") return "opening_balance";
  return id === "loans_released" || id === "collections" || id === "collection_rate" ? "previous_period" : null;
}

/** The Executive Overview cards, in order. */
export function overviewKpis(d: ExecutiveData): KpiView[] {
  return OVERVIEW_METRICS.map((id) => {
    const source = d[KPI_SOURCE[id]];
    const { value, change } = kpiValue(id, d);
    const state: KpiState =
      source.state === "loading"
        ? "loading"
        : source.state === "denied"
          ? "denied"
          : value === null
            ? "unavailable"
            : "ready";
    return { id, value, change, changeBasis: changeBasis(id), state };
  });
}

/** Whether a metric is a position "as of today" no matter the period picked. */
export function isAsOfToday(id: MetricId): boolean {
  return KPI_SOURCE[id] === "balance" || id === "active_borrowers";
}

