/**
 * The rows and points behind the executive dashboard's charts and tables,
 * built from the loaded reports. Pure.
 */

import type { AccountingDashboard } from "@/types/accounting";
import type {
  AgingReport,
  CollectionEfficiencyReport,
  PerformanceReport,
  PortfolioByProductReport,
} from "@/types/dashboard-reports";
import { toNumber } from "./metrics";
import { fromCentavos } from "./executive-data";

export interface ProductRow {
  name: string;
  loans: number | null;
  released: number | null;
  /** Principal Balance (`outstanding_principal`). */
  principal: number | null;
  /** Everything owed (`total_outstanding`). */
  outstanding: number | null;
  par: number | null;
  /** The server's share of the unpaid principal, in percent (`outstanding_share`); `null` when not sent. */
  share: number | null;
}

const productName = (name: string | null | undefined) => name?.trim() || "Unnamed product";

/** Products by everything owed (`total_outstanding`), largest first, with the server's share of the outstanding book. */
export function productRows(report: PortfolioByProductReport | null): ProductRow[] {
  return (report?.products ?? [])
    .map((p) => ({
      name: productName(p.product_name),
      loans: toNumber(p.loan_count),
      released: toNumber(p.total_released),
      principal: toNumber(p.outstanding_principal),
      outstanding: toNumber(p.total_outstanding),
      par: toNumber(p.par_ratio),
      share: toNumber(p.outstanding_share),
    }))
    .sort((a, b) => (b.outstanding ?? -1) - (a.outstanding ?? -1));
}

export interface ProductShareSlice {
  name: string;
  /** The server's `outstanding_share`, whole percent. */
  share: number;
  other: boolean;
}

/**
 * The product share chart: the server's named products (`named_product_ids`,
 * largest first) by their `outstanding_share`, then its `other` row as one
 * slice. Every share is the server's; nothing is added up here.
 */
export function productShareSlices(report: PortfolioByProductReport | null): ProductShareSlice[] {
  const products = report?.products ?? [];
  const named = (report?.named_product_ids ?? []).flatMap((id) => {
    const product = products.find((p) => p.product_id === id);
    const share = toNumber(product?.outstanding_share);
    return product && share !== null && share > 0 ? [{ name: productName(product.product_name), share, other: false }] : [];
  });
  const other = report?.other;
  const count = toNumber(other?.product_count) ?? 0;
  const otherShare = toNumber(other?.outstanding_share);
  if (count > 0 && otherShare !== null && otherShare > 0) {
    named.push({ name: `${count} other ${count === 1 ? "product" : "products"}`, share: otherShare, other: true });
  }
  return named;
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
      outstanding: toNumber(o.total_outstanding),
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
  ["for_review", "For Approval"],
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

/**
 * Whether any point has a non-zero figure in `keys`. A chart of only zeros or
 * gaps shows its empty state instead of an axis running ₱0.00 to ₱4.00.
 */
export function hasActivity<T extends object>(points: readonly T[], keys: readonly (keyof T)[]): boolean {
  return points.some((p) => keys.some((k) => {
    const v = p[k];
    return typeof v === "number" && Number.isFinite(v) && v !== 0;
  }));
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
