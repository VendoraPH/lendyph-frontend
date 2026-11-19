/**
 * The executive dashboard's books, trends, turnaround and share capital
 * control, read from EB-D2's endpoints and `/accounting/dashboard`. Pure and
 * display only: every figure and state is the server's.
 */

import { formatCurrency, formatDate } from "@/lib/format";
import type { AccountingDashboard } from "@/types/accounting";
import type {
  ExecutiveFilterKey,
  ExecutiveTurnaround,
  FiltersAppliedTo,
  ShareCapitalControl,
  TrendMonth,
} from "@/types/executive-dashboard";
import { ignoredFilterNote } from "./executive-overview";
import { monthLabel } from "./executive-sections";

/** Which sent filters a figure of an EB-D2 response follows: every figure for `filters_applied`, some for `filters_applied_to`. */
export function figureFilterNote(sent: readonly ExecutiveFilterKey[], response: FiltersAppliedTo, figure: string): string | null {
  // A named path covers itself and every figure under it ("by_officer" covers "by_officer.collected").
  const covers = (path: string) => figure === path || figure.startsWith(`${path}.`);
  const followed = sent.filter(
    (key) => response.filters_applied.includes(key) || (response.filters_applied_to[key] ?? []).some(covers),
  );
  return ignoredFilterNote(sent, followed);
}

/**
 * One report figure's note: from the report's own `filters_applied` and
 * `filters_applied_to` (EB-A) when it sends them, else from the filters the
 * figure is known to follow. Each figure gets its own, never the section.
 */
export function reportFigureNote(
  sent: readonly ExecutiveFilterKey[],
  report: Partial<FiltersAppliedTo> | null | undefined,
  figure: string,
  known: readonly ExecutiveFilterKey[],
): string | null {
  if (report && Array.isArray(report.filters_applied)) {
    return figureFilterNote(sent, { filters_applied: report.filters_applied, filters_applied_to: report.filters_applied_to ?? {} }, figure);
  }
  return ignoredFilterNote(sent, known);
}

/**
 * The page filters each section follows, where its response names none:
 * share capital isn't kept by product, officer or collector.
 */
export const SECTION_FILTERS = {
  shareCapitalControl: [] as ExecutiveFilterKey[],
} as const;

/** The note for a section that ignores some sent filters, from its known filters. */
export function sectionFilterNote(sent: readonly ExecutiveFilterKey[], section: keyof typeof SECTION_FILTERS): string | null {
  return ignoredFilterNote(sent, SECTION_FILTERS[section]);
}

// ── Financial section ──────────────────────────────────────────────────────

/** Centavos as ₱ with two decimals; a figure the server didn't send reads a dash, never ₱0.00. */
const pesos = (centavos: number | null | undefined) =>
  typeof centavos === "number" && Number.isFinite(centavos) ? formatCurrency(centavos / 100) : "—";

export interface FinancialBooks {
  state: "ready" | "requires_configuration" | "books_not_set_up";
  /** The books' state in the server's words, while they aren't ready. */
  notice: string | null;
  figures: { label: string; value: string; hint?: string }[];
}

/**
 * The financial section's figures, from `/accounting/dashboard`: its period
 * lines (income basis: cash), `cash_total`, assets and equity. While
 * `books_state` isn't ready, none are shown: the server's label and reason
 * are, so missing books never read ₱0.00.
 */
export function financialBooks(acc: AccountingDashboard): FinancialBooks {
  const books = acc.books_state ?? { state: "ready" as const, label: "Ready", reason: null };
  if (books.state !== "ready") {
    return { state: books.state, notice: [books.label, books.reason].filter(Boolean).join(": "), figures: [] };
  }
  const p = acc.period;
  return {
    state: "ready",
    notice: null,
    figures: [
      { label: "Income (period)", value: pesos(p?.income) },
      { label: "Expenses (period)", value: pesos(p?.expenses) },
      { label: "Net income (period)", value: pesos(p?.net_income) },
      { label: p?.interest_income_label ?? "Interest income (cash basis)", value: pesos(p?.interest_income) },
      { label: "Penalty income", value: pesos(p?.penalty_income) },
      { label: p?.fee_income_label ?? "Fee income", value: pesos(p?.fee_income) },
      { label: "Cash balance", value: pesos(acc.cash_total), hint: `All money accounts, as of ${formatDate(acc.as_of)}` },
      { label: "Total assets", value: pesos(acc.total_assets) },
      { label: "Total equity", value: pesos(acc.total_equity) },
    ],
  };
}

// ── Trends ─────────────────────────────────────────────────────────────────

export type TrendPoint = Omit<TrendMonth, "from" | "to"> & { label: string };

/** The server's months for Charts B (released against collected), I (cash in and out) and L (new members). */
export function trendSeries(months: TrendMonth[]): TrendPoint[] {
  return months.map((m) => ({
    month: m.month,
    label: monthLabel(m.month),
    principal_released: m.principal_released,
    principal_collected: m.principal_collected,
    cash_in: m.cash_in,
    cash_out: m.cash_out,
    net_cash: m.net_cash,
    new_members: m.new_members,
  }));
}

// ── Turnaround ─────────────────────────────────────────────────────────────

const STRETCHES = [
  ["submitted_to_approved", "Submitted to approved"],
  ["approved_to_released", "Approved to released"],
  ["submitted_to_released", "Submitted to released"],
] as const;

const days = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)} days`);

/** Average and median days per stretch, as the server measured them. */
export function turnaroundRows(data: ExecutiveTurnaround) {
  return STRETCHES.map(([key, label]) => {
    const stretch = data[key];
    return {
      key,
      label,
      average: days(stretch.average_days),
      median: days(stretch.median_days),
      loans: String(stretch.loans),
      note:
        stretch.not_measured > 0
          ? `${stretch.not_measured} ${stretch.not_measured === 1 ? "loan had" : "loans had"} no start to measure from.`
          : null,
    };
  });
}

// ── Share capital control ──────────────────────────────────────────────────

const RECONCILED: Record<string, string> = { true: "Agrees", false: "Differs", null: "Not compared" };

/** The share capital subledger against its account, by branch, with the server's totals (never a sum of the rows). */
export function shareCapitalControlTable(control: ShareCapitalControl) {
  const ready = control.books_state.state === "ready";
  const row = (r: ShareCapitalControl["totals"]) => ({
    subledger: pesos(r.subledger),
    books: pesos(r.books),
    difference: pesos(r.difference),
    status: RECONCILED[String(r.is_reconciled)],
  });
  const asOf = formatDate(control.as_of);
  return {
    notice: ready ? null : [control.books_state.label, control.books_state.reason].filter(Boolean).join(": "),
    account: control.account ? `${control.account.code} ${control.account.name}` : null,
    rows: control.rows.map((r) => ({ key: r.branch_id === null ? "none" : String(r.branch_id), name: r.branch_name, ...row(r) })),
    totals: row(control.totals),
    summary:
      control.is_reconciled === null
        ? `Not compared as of ${asOf}.`
        : control.is_reconciled
          ? `The subledger and account ${control.account?.code ?? ""} agree as of ${asOf}.`
          : `The subledger and account ${control.account?.code ?? ""} differ by ${pesos(Math.abs(control.totals.difference ?? 0))} as of ${asOf}.`,
  };
}
