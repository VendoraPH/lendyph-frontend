import { countOrDash, currencyOrDash, formatValue } from "@/lib/report-format";
import type {
  SavingsDashboardKpis,
  SavingsDashboardMonth,
  SavingsMaturityBucket,
} from "@/types/savings-insight";

/**
 * The Savings dashboard's screen model. Every figure is the server's
 * two-decimal string, shown with ₱ and two decimals; nothing is added up or
 * derived here. The charts plot the same strings as numbers, and only their
 * axis ticks are abbreviated.
 */

export interface KpiCard {
  key: string;
  label: string;
  value: string;
  caption?: string;
  /** Colours the figure by its sign (net movement). */
  signed?: "positive" | "negative" | null;
}

const plural = (count: unknown, one: string, many: string) =>
  `${countOrDash(count)} ${count === 1 ? one : many}`;

/** "positive" or "negative" by the server figure's own sign; null for zero or a missing figure. */
export function signOf(value: string | null | undefined): "positive" | "negative" | null {
  const n = Number(value);
  if (typeof value !== "string" || value.trim() === "" || !Number.isFinite(n) || n === 0) return null;
  return n < 0 ? "negative" : "positive";
}

/** The headline cards, in the Savings task's order (TASK 35). */
export function kpiCards(k: SavingsDashboardKpis | null | undefined): KpiCard[] {
  if (!k) return [];
  const asOfToday = `As of ${formatValue(k.accounts?.as_of, "date")}`;
  return [
    {
      key: "total_deposits",
      label: "Total Deposit Liabilities",
      value: currencyOrDash(k.total_deposits),
      caption: "Savings plus time deposits outstanding",
    },
    { key: "savings_balance", label: "Savings Deposits", value: currencyOrDash(k.savings_balance) },
    {
      key: "time_deposits",
      label: "Time Deposits",
      value: currencyOrDash(k.time_deposits?.amount),
      caption: plural(k.time_deposits?.count, "placement", "placements"),
    },
    {
      key: "active_accounts",
      label: "Active Accounts",
      value: countOrDash(k.accounts?.active),
      caption: `${countOrDash(k.accounts?.frozen)} frozen · ${asOfToday}`,
    },
    { key: "new_accounts", label: "New Accounts", value: countOrDash(k.new_accounts), caption: "Opened in the period" },
    {
      key: "deposits",
      label: "Deposits",
      value: currencyOrDash(k.deposits?.amount),
      caption: plural(k.deposits?.count, "deposit", "deposits"),
    },
    {
      key: "withdrawals",
      label: "Withdrawals",
      value: currencyOrDash(k.withdrawals?.amount),
      caption: `${plural(k.withdrawals?.count, "withdrawal", "withdrawals")}, closing payouts included`,
    },
    {
      key: "net_deposit_movement",
      label: "Deposits less Withdrawals",
      value: currencyOrDash(k.net_deposit_movement),
      caption: "Member money in less money out; fees, transfers to share capital and interest are not in it",
      signed: signOf(k.net_deposit_movement),
    },
    {
      key: "interest_credited",
      label: "Interest Paid",
      value: currencyOrDash(k.interest_credited?.net),
      caption: `Savings interest credited: ${currencyOrDash(k.interest_credited?.gross)} gross, ${currencyOrDash(k.interest_credited?.tax)} tax`,
    },
    {
      key: "time_deposit_interest",
      label: "Time Deposit Interest Paid",
      value: currencyOrDash(k.time_deposit_interest_paid?.gross),
      caption: `${currencyOrDash(k.time_deposit_interest_paid?.tax)} tax withheld`,
    },
    {
      key: "fees_charged",
      label: "Fees Charged",
      value: currencyOrDash(k.fees_charged?.amount),
      caption: `${plural(k.fees_charged?.count, "excess-withdrawal fee", "excess-withdrawal fees")}`,
    },
    {
      key: "share_capital_transfers",
      label: "Transfers to Share Capital",
      value: currencyOrDash(k.share_capital_transfers?.amount),
      caption: plural(k.share_capital_transfers?.count, "transfer", "transfers"),
    },
    {
      key: "dormant_accounts",
      label: "Dormant Accounts",
      value: countOrDash(k.accounts?.dormant),
      caption: asOfToday,
    },
    {
      key: "maturing_30_days",
      label: "Maturing in 30 Days",
      value: currencyOrDash(k.maturing_30_days?.maturity_amount),
      caption: `${plural(k.maturing_30_days?.count, "time deposit", "time deposits")}, ${currencyOrDash(k.maturing_30_days?.principal)} principal`,
    },
  ];
}

/** The savings GL control in words, from the server's own warning. */
export interface GlNotice {
  tone: "ok" | "warning";
  message: string;
  /** Set when a product was picked: the GL has no product. */
  productNote: string | null;
}

export function glNotice(k: SavingsDashboardKpis | null | undefined): GlNotice | null {
  const control = k?.gl_control;
  if (!control) return null;
  const asOf = formatValue(control.as_of, "date");
  const productNote = control.product_filter_ignored
    ? "The books have no product, so this check covers every product in the branch."
    : null;
  if (control.is_balanced) {
    return { tone: "ok", message: `Savings records agree with the books as of ${asOf}.`, productNote };
  }
  return {
    tone: "warning",
    message: `${control.warning ?? "Savings records and the books differ."} Difference ${currencyOrDash(control.difference)} as of ${asOf}.`,
    productNote,
  };
}

/** The series' figures in words, for the tooltips and the screen-reader tables. */
export const SERIES_LABELS: Record<keyof SeriesPoint["text"], string> = {
  savings_balance: "Savings",
  time_deposits: "Time deposits",
  total_deposits: "Total deposits",
  deposits: "Deposits",
  withdrawals: "Withdrawals",
  net_movement: "Change in total deposits",
};

/** What the monthly change holds, unlike the period's deposits less withdrawals. */
export const SERIES_NOTE =
  "Change in total deposits is each month's closing savings and time deposits less the month before, after interest, fees and transfers.";

/** One month of the charts: figures as numbers to plot, and the server's strings for the tooltip. */
export interface SeriesPoint {
  month: string;
  tick: string;
  label: string;
  savings_balance: number | null;
  time_deposits: number | null;
  deposits: number | null;
  withdrawals: number | null;
  text: Record<"savings_balance" | "time_deposits" | "total_deposits" | "deposits" | "withdrawals" | "net_movement", string>;
}

function plot(value: string | null | undefined): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function seriesPoints(series: readonly SavingsDashboardMonth[] | null | undefined): SeriesPoint[] {
  return (series ?? []).map((m) => {
    const monthIndex = Number(m.month?.slice(5, 7)) - 1;
    return {
      month: m.month,
      tick: MONTHS[monthIndex] ?? m.month,
      label: m.label || m.month,
      savings_balance: plot(m.savings_balance),
      time_deposits: plot(m.time_deposits),
      deposits: plot(m.deposits),
      withdrawals: plot(m.withdrawals),
      text: {
        savings_balance: currencyOrDash(m.savings_balance),
        time_deposits: currencyOrDash(m.time_deposits),
        total_deposits: currencyOrDash(m.total_deposits),
        deposits: currencyOrDash(m.deposits),
        withdrawals: currencyOrDash(m.withdrawals),
        net_movement: currencyOrDash(m.net_movement),
      },
    };
  });
}

/** A maturity bucket for the chart and its table. */
export interface BucketPoint {
  key: string;
  label: string;
  maturity_amount: number | null;
  count: string;
  principal: string;
  due: string;
}

export function bucketPoints(buckets: readonly SavingsMaturityBucket[] | null | undefined): BucketPoint[] {
  return (buckets ?? []).map((b) => ({
    key: b.key,
    label: b.label,
    maturity_amount: plot(b.maturity_amount),
    count: countOrDash(b.count),
    principal: currencyOrDash(b.principal),
    due: currencyOrDash(b.maturity_amount),
  }));
}

const COMPACT = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

/** An axis tick, abbreviated on purpose ("₱130K"). Tooltips and tables show the full figure. */
export function compactPesoAxis(pesos: number): string {
  const sign = pesos < 0 ? "-" : "";
  return `${sign}₱${COMPACT.format(Math.abs(pesos))}`;
}
