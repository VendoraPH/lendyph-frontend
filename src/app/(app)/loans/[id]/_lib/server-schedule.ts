import type { ApiScheduleRow } from "@/lib/amortization";
import type { LoanSchedule } from "@/types/loan";

/** One row of the schedule the loan page draws. */
export interface AmortizationRow {
  period: number;
  dueDate: Date;
  principal: number;
  interest: number;
  shareCapitalBuildUp: number;
  totalPayment: number;
  balance: number;
  status?: "pending" | "paid" | "partial" | "overdue";
  amountPaid?: number;
}

/**
 * Schedule rows as the server sent them, in `LoanSchedule` shape.
 *
 * Reads both `GET /loans/{id}/amortization-schedule` (the persisted schedule)
 * and `GET /loans/{id}/amortization-preview` (what release would persist): both
 * carry `principal_due`, `interest_due`, `total_due` and `remaining_balance`,
 * which is what `schedule` is built from. The preview has no paid columns, so
 * its rows read as nothing paid.
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
        }) as LoanSchedule)
      : rows as unknown as LoanSchedule[],
  };
}

/**
 * The server's schedule rows as the page draws them.
 *
 * Every row comes from the server; nothing is generated here. No rows in means
 * no rows out, so a loan the server holds no instalments for shows none.
 */
export function toDisplaySchedule(
  schedule: readonly LoanSchedule[],
  {
    principalAmount,
    scb,
    isUponMaturity,
  }: {
    principalAmount: number | string | undefined;
    scb: number;
    isUponMaturity: boolean;
  },
): AmortizationRow[] {
  if (schedule.length === 0) return [];
  if (isUponMaturity) {
    // Backend may return one row per period; collapse everything into a single maturity payment
    const lastRow = schedule[schedule.length - 1];
    const totalPrincipal = schedule.reduce((s, r) => s + (parseFloat(String(r.principal)) || 0), 0);
    const totalInterest = schedule.reduce((s, r) => s + (parseFloat(String(r.interest)) || 0), 0);
    const totalAmountDue = schedule.reduce((s, r) => s + (parseFloat(String(r.amount_due)) || 0), 0);
    const totalAmountPaid = schedule.reduce((s, r) => s + (parseFloat(String(r.amount_paid)) || 0), 0);
    const totalScb = scb * schedule.length;
    return [{
      period: 1,
      dueDate: new Date(lastRow.due_date),
      principal: totalPrincipal,
      interest: totalInterest,
      shareCapitalBuildUp: totalScb,
      totalPayment: totalAmountDue + totalScb,
      balance: parseFloat(String(lastRow.balance)) || 0,
      status: lastRow.status,
      amountPaid: totalAmountPaid,
    }];
  }
  // Compute running principal balance ourselves; backend often returns 0
  // for `remaining_balance`, which leaves the Balance column blank.
  // Starts at the full loan principal and decreases by each row's principal portion.
  let runningBalance = Number(principalAmount ?? 0);
  return schedule.map((row, idx) => {
    const rowPrincipal = parseFloat(String(row.principal)) || 0;
    const apiBalance = parseFloat(String(row.balance)) || 0;
    runningBalance = Math.max(0, runningBalance - rowPrincipal);
    return {
      period: idx + 1,
      dueDate: new Date(row.due_date),
      principal: rowPrincipal,
      interest: parseFloat(String(row.interest)) || 0,
      shareCapitalBuildUp: scb,
      totalPayment: (parseFloat(String(row.amount_due)) || 0) + scb,
      balance: apiBalance > 0 ? apiBalance : runningBalance,
      status: row.status,
      amountPaid: parseFloat(String(row.amount_paid)) || 0,
    };
  });
}
