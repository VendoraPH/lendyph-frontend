/**
 * The rows and points behind the executive dashboard's charts and tables,
 * built from the loaded reports. Pure.
 */

import type { AccountingDashboard } from "@/types/accounting";
import type {
  AgingReport,
  CollectionEfficiencyReport,
  LoanBalanceSummaryReport,
  PerformanceReport,
  PortfolioByProductReport,
} from "@/types/dashboard-reports";
import { toNumber } from "./metrics";
import { fromCentavos } from "./executive-data";

export interface ProductRow {
  name: string;
  loans: number | null;
  released: number | null;
  outstanding: number | null;
  par: number | null;
  /** Share of the outstanding book, in percent; `null` when the book total is unknown or zero. */
  share: number | null;
}

/** Products by outstanding balance, largest first, with their share of the book. */
export function productRows(report: PortfolioByProductReport | null): ProductRow[] {
  const rows = (report?.products ?? []).map((p) => ({
    name: p.product_name?.trim() || "Unnamed product",
    loans: toNumber(p.loan_count),
    released: toNumber(p.total_released),
    outstanding: toNumber(p.outstanding),
    par: toNumber(p.par_ratio),
  }));
  const book = rows.reduce((sum, r) => sum + (r.outstanding ?? 0), 0);
  return rows
    .map((r) => ({ ...r, share: book > 0 && r.outstanding !== null ? (r.outstanding / book) * 100 : null }))
    .sort((a, b) => (b.outstanding ?? -1) - (a.outstanding ?? -1));
}

export interface AgingPoint {
  bucket: string;
  amount: number;
  count: number;
}

const AGING_BUCKETS = [
  ["1_30", "1–30 days"],
  ["31_60", "31–60 days"],
  ["61_90", "61–90 days"],
  ["over_90", "Over 90 days"],
] as const;

/** Past due by age. Empty when the report did not arrive, so the chart says so instead of drawing zeros. */
export function agingPoints(report: AgingReport | null): AgingPoint[] {
  if (!report?.buckets) return [];
  return AGING_BUCKETS.map(([key, bucket]) => ({
    bucket,
    amount: toNumber(report.buckets?.[key]?.amount) ?? 0,
    count: toNumber(report.buckets?.[key]?.count) ?? 0,
  }));
}

export interface TrendPoint {
  period: string;
  due: number;
  collected: number;
  rate: number | null;
}

/** Due against collected, one point per month of the range. */
export function collectionTrend(report: CollectionEfficiencyReport | null): TrendPoint[] {
  return (report?.by_period ?? [])
    .filter((p) => typeof p.period === "string")
    .map((p) => ({
      period: p.period as string,
      due: toNumber(p.total_due) ?? 0,
      collected: toNumber(p.total_collected) ?? 0,
      rate: toNumber(p.collection_rate),
    }));
}

export interface BranchRow {
  key: string;
  name: string;
  outstanding: number | null;
  released: number | null;
  collected: number | null;
  collectionRate: number | null;
  par: number | null;
  activeBorrowers: number | null;
}

/** One row per branch, merged across the balance, efficiency and performance reports by branch id. */
export function branchRows(
  balance: LoanBalanceSummaryReport | null,
  efficiency: CollectionEfficiencyReport | null,
  performance: PerformanceReport | null,
): BranchRow[] {
  const rows = new Map<string, BranchRow>();
  const row = (id: number | null | undefined, name: string | null | undefined) => {
    const key = id == null ? `name:${name ?? ""}` : String(id);
    let r = rows.get(key);
    if (!r) {
      r = {
        key,
        name: name?.trim() || "No branch",
        outstanding: null,
        released: null,
        collected: null,
        collectionRate: null,
        par: null,
        activeBorrowers: null,
      };
      rows.set(key, r);
    }
    return r;
  };
  for (const b of balance?.by_branch ?? []) {
    row(b.branch_id, b.branch_name).outstanding = toNumber(b.outstanding_balance);
  }
  for (const b of efficiency?.by_branch ?? []) {
    const r = row(b.branch_id, b.branch_name);
    r.collected = toNumber(b.total_collected);
    r.collectionRate = toNumber(b.collection_rate);
  }
  for (const b of performance?.by_branch ?? []) {
    const r = row(b.branch_id, b.branch_name);
    r.released = toNumber(b.released_amount);
    r.par = toNumber(b.par_ratio);
    r.activeBorrowers = toNumber(b.active_borrowers);
  }
  return [...rows.values()].sort((a, b) => (b.outstanding ?? -1) - (a.outstanding ?? -1));
}

export interface OfficerRow {
  key: string;
  name: string;
  released: number | null;
  collected: number | null;
  outstanding: number | null;
  par: number | null;
  activeBorrowers: number | null;
}

/** Loan officers by outstanding portfolio, largest first. */
export function officerRows(report: PerformanceReport | null, limit = 10): OfficerRow[] {
  return (report?.by_officer ?? [])
    .map((o, i) => ({
      key: o.officer_id == null ? `row:${i}` : String(o.officer_id),
      name: o.officer_name?.trim() || "Unassigned",
      released: toNumber(o.released_amount),
      collected: toNumber(o.collected),
      outstanding: toNumber(o.outstanding),
      par: toNumber(o.par_ratio),
      activeBorrowers: toNumber(o.active_borrowers),
    }))
    .sort((a, b) => (b.outstanding ?? -1) - (a.outstanding ?? -1))
    .slice(0, limit);
}

export interface PipelineStage {
  status: string;
  label: string;
  count: number;
}

const PIPELINE: [string, string][] = [
  ["draft", "Draft"],
  ["for_review", "For review"],
  ["approved", "Approved, awaiting release"],
  ["rejected", "Rejected"],
];

/** Applications by stage, from the loan list's `meta.stats`. */
export function pipelineStages(stats: Record<string, number> | null): PipelineStage[] {
  if (!stats) return [];
  return PIPELINE.map(([status, label]) => ({ status, label, count: toNumber(stats[status]) ?? 0 }));
}

export interface IncomeExpensePoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

/** The ledger's last 12 months, in pesos. */
export function incomeExpenseSeries(accounting: AccountingDashboard | null): IncomeExpensePoint[] {
  return (accounting?.months ?? []).map((m) => ({
    month: m.month,
    income: fromCentavos(m.income) ?? 0,
    expenses: fromCentavos(m.expenses) ?? 0,
    net: fromCentavos(m.net_income) ?? 0,
  }));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11" → "Nov 2026"; anything else is shown as sent. */
export function monthLabel(period: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(period);
  if (!m) return period;
  const name = MONTHS[Number(m[2]) - 1];
  return name ? `${name} ${m[1]}` : period;
}
