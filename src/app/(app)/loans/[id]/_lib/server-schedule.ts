import type { ApiScheduleRow } from "@/lib/amortization";
import type { LoanSchedule } from "@/types/loan";

/**
 * One row of the schedule the loan page draws. Every figure is the server's;
 * null is one the server did not send, shown as a dash.
 */
export interface AmortizationRow {
  /** Position on screen, 1-based: the "#" column. Not the server's number. */
  period: number;
  /** The server's `period_number`; null on the merged upon-maturity row. */
  periodNumber: number | null;
  /** The server's schedule row id; null on preview and merged rows. */
  scheduleId: number | null;
  dueDate: Date;
  principal: number | null;
  interest: number | null;
  shareCapitalBuildUp: number | null;
  totalPayment: number | null;
  balance: number;
  status?: "pending" | "paid" | "partial" | "overdue";
}

/**
 * The schedule's column totals, as the server added them up
 * (`GET /loans/{id}` `amortization_schedule_totals`). Null is a total the
 * server did not send, shown as a dash, never a sum of the rows.
 */
export interface ScheduleTotals {
  principal: number | null;
  interest: number | null;
  shareCapitalBuildUp: number | null;
  totalPayment: number | null;
}

/** No totals from the server: every one is a dash. */
export const NO_SCHEDULE_TOTALS: ScheduleTotals = Object.freeze({
  principal: null,
  interest: null,
  shareCapitalBuildUp: null,
  totalPayment: null,
});

/** A money figure as the server sent it (number or decimal string), or null. */
function serverFigure(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** A positive whole number as the server sent it, or null. */
function serverId(raw: unknown): number | null {
  const value = serverFigure(raw);
  return value !== null && Number.isInteger(value) && value > 0 ? value : null;
}

/** The server's `amortization_schedule_totals`, each one null when absent. */
export function readScheduleTotals(raw: unknown): ScheduleTotals {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NO_SCHEDULE_TOTALS;
  const t = raw as Record<string, unknown>;
  return {
    principal: serverFigure(t.principal),
    interest: serverFigure(t.interest),
    shareCapitalBuildUp: serverFigure(t.share_capital_build_up),
    totalPayment: serverFigure(t.total_payment),
  };
}

/**
 * `GET /loans/{id}/amortization-preview`'s envelope: its rows, read as
 * `readScheduleRows` reads them, and its `totals` (`principal_due`,
 * `interest_due`, `share_capital_build_up`, `total_payment`) in the display
 * shape, each null when absent. Null when `data` is not a list of rows.
 */
export function readPreviewResponse(
  res: unknown,
  loanId: number,
): { schedule: LoanSchedule[]; totals: ScheduleTotals } | null {
  if (!res || typeof res !== "object" || Array.isArray(res)) return null;
  const envelope = res as { data?: unknown; totals?: unknown };
  if (!Array.isArray(envelope.data)) return null;
  const read = readScheduleRows(envelope.data, loanId);
  if (read === null) return null;
  const t = envelope.totals;
  const totals =
    t && typeof t === "object" && !Array.isArray(t)
      ? {
          principal: serverFigure((t as Record<string, unknown>).principal_due),
          interest: serverFigure((t as Record<string, unknown>).interest_due),
          shareCapitalBuildUp: serverFigure((t as Record<string, unknown>).share_capital_build_up),
          totalPayment: serverFigure((t as Record<string, unknown>).total_payment),
        }
      : NO_SCHEDULE_TOTALS;
  return { schedule: read.schedule, totals };
}

/**
 * Schedule rows as the server sent them, in `LoanSchedule` shape.
 *
 * Reads both `GET /loans/{id}/amortization-schedule` (the persisted schedule)
 * and `GET /loans/{id}/amortization-preview` (what release would persist): both
 * carry `principal_due`, `interest_due`, `total_due` and `remaining_balance`,
 * which is what `schedule` is built from. The preview has no paid columns, so
 * its rows read as nothing paid. `share_capital_build_up` and `total_payment`
 * are taken as sent, and are null on rows that do not carry them.
 *
 * `raw` keeps the persisted rows untouched when they carry that breakdown, for
 * the figures that need `interest_paid` per row. An empty list is an answer —
 * no instalments — and comes back as an empty `schedule`. Null means the
 * payload is not a list at all, which the page treats as a failed read.
 */
export function readScheduleRows(
  res: unknown,
  loanId: number,
): { schedule: LoanSchedule[]; raw: ApiScheduleRow[] | null } | null {
  // API may return { schedule: [...], summary: {...} } or a plain array
  const rows = Array.isArray(res) ? res : (res as { schedule?: unknown } | null)?.schedule;
  if (!Array.isArray(rows)) return null;
  if (rows.length === 0) return { schedule: [], raw: null };
  // Map ApiScheduleRow field names to LoanSchedule field names
  const first = rows[0] as Record<string, unknown>;
  const isApiFormat = "principal_due" in first;
  return {
    // Keep the raw rows only when they carry the API breakdown fields
    // (interest_due / interest_paid).
    raw: isApiFormat ? (rows as unknown as ApiScheduleRow[]) : null,
    schedule: isApiFormat
      ? (rows as Record<string, unknown>[]).map((r) => ({
          id: Number(r.id) || 0,
          loan_id: Number(r.loan_id) || loanId,
          due_date: String(r.due_date ?? ""),
          principal: parseFloat(String(r.principal_due ?? 0)),
          interest: parseFloat(String(r.interest_due ?? 0)),
          amount_due: parseFloat(String(r.total_due ?? 0)),
          amount_paid: parseFloat(String(r.principal_paid ?? 0)) + parseFloat(String(r.interest_paid ?? 0)),
          balance: parseFloat(String(r.remaining_balance ?? 0)),
          status: (r.status as LoanSchedule["status"]) ?? "pending",
          share_capital_build_up: serverFigure(r.share_capital_build_up),
          total_payment: serverFigure(r.total_payment),
          period_number: serverId(r.period_number),
        }) as LoanSchedule)
      : rows as unknown as LoanSchedule[],
  };
}

/**
 * The server's schedule rows as the page draws them.
 *
 * Every row comes from the server; nothing is generated or added up here. No
 * rows in means no rows out, so a loan the server holds no instalments for
 * shows none. Each row's build-up and total payment are the server's
 * `share_capital_build_up` and `total_payment`, null when it sent none.
 *
 * An upon-maturity loan is drawn as one maturity payment. With more than one
 * row (an extension leaves the settled cycle beside the open one) its figures
 * are the server's column `totals`, a dash for any it did not send.
 */
export function toDisplaySchedule(
  schedule: readonly LoanSchedule[],
  {
    isUponMaturity,
    totals,
  }: {
    isUponMaturity: boolean;
    totals: ScheduleTotals;
  },
): AmortizationRow[] {
  if (schedule.length === 0) return [];
  if (isUponMaturity && schedule.length > 1) {
    const lastRow = schedule[schedule.length - 1];
    return [{
      period: 1,
      periodNumber: null,
      scheduleId: null,
      dueDate: new Date(lastRow.due_date),
      principal: totals.principal,
      interest: totals.interest,
      shareCapitalBuildUp: totals.shareCapitalBuildUp,
      totalPayment: totals.totalPayment,
      balance: parseFloat(String(lastRow.balance)) || 0,
      status: lastRow.status,
    }];
  }
  // The Balance column is the server's `remaining_balance` on every row, zero
  // included: after a balance adjustment it is not principal minus principal.
  return schedule.map((row, idx) => ({
    period: idx + 1,
    periodNumber: serverId(row.period_number),
    scheduleId: serverId(row.id),
    dueDate: new Date(row.due_date),
    principal: parseFloat(String(row.principal)) || 0,
    interest: parseFloat(String(row.interest)) || 0,
    shareCapitalBuildUp: serverFigure(row.share_capital_build_up),
    totalPayment: serverFigure(row.total_payment),
    balance: parseFloat(String(row.balance)) || 0,
    status: row.status,
  }));
}

/** The server's rows one per period, never merged into an upon-maturity row. */
function periodRows(schedule: readonly LoanSchedule[]): AmortizationRow[] {
  return toDisplaySchedule(schedule, { isUponMaturity: false, totals: NO_SCHEDULE_TOTALS });
}

/**
 * The periods not yet paid (partial, overdue, pending), in order, each with
 * its own server figures. Never the merged upon-maturity row: after an
 * extension the settled cycle stays as a paid row, and the merged totals
 * include what it already collected.
 */
export function openPeriods(schedule: readonly LoanSchedule[]): AmortizationRow[] {
  return periodRows(schedule).filter((row) => row.status !== "paid");
}

/** The period the borrower pays next (the first open one), or null when all are paid. */
export function openPeriod(schedule: readonly LoanSchedule[]): AmortizationRow | null {
  return openPeriods(schedule)[0] ?? null;
}

/** What a payment preview allocation names its period by. */
export interface AllocationRef {
  schedule_id?: number;
  /** The server's `period_number`. */
  period?: number;
}

/**
 * Whether `allocation` is for `row`: by schedule id when both carry one,
 * otherwise by the server's period number. Never by position, since period
 * numbers can skip (an extension deletes an open row that collected nothing).
 */
export function allocationMatches(allocation: AllocationRef, row: AmortizationRow): boolean {
  if (typeof allocation.schedule_id === "number" && row.scheduleId !== null) {
    return allocation.schedule_id === row.scheduleId;
  }
  return typeof allocation.period === "number" && row.periodNumber !== null && allocation.period === row.periodNumber;
}

/**
 * The server's own row for a payment preview allocation, or null when the
 * schedule has none. Never the merged upon-maturity row, which carries the
 * whole schedule's totals.
 */
export function rowForAllocation(schedule: readonly LoanSchedule[], allocation: AllocationRef): AmortizationRow | null {
  return periodRows(schedule).find((row) => allocationMatches(allocation, row)) ?? null;
}

/**
 * The build-up of an allocation's period, as the server sent it, or null (a
 * dash) when the schedule has no row for it or the server sent none.
 */
export function allocationBuildUp(schedule: readonly LoanSchedule[], allocation: AllocationRef): number | null {
  return rowForAllocation(schedule, allocation)?.shareCapitalBuildUp ?? null;
}

/**
 * How a payment stands against the open period's server total payment, to
 * the centavo: `covers` it (or there is no open period), falls short of it
 * (`partial`), or `unknown` when the server sent no total for the period.
 */
export function paymentAgainstDue(
  amount: number,
  due: AmortizationRow | null,
): "covers" | "partial" | "unknown" {
  if (due === null) return "covers";
  if (due.totalPayment === null) return "unknown";
  return Math.round(amount * 100) < Math.round(due.totalPayment * 100) ? "partial" : "covers";
}
