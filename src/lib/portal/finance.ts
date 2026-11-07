import { formatDateISO } from "@/lib/format";
import type { Money, PortalLoanStatus, ScheduleRowStatus, StatementKind } from "@/types/portal";
import type { Tone } from "./labels";

export const LOAN_STATUS: Record<PortalLoanStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "info" },
  approved: { label: "Approved", tone: "info" },
  active: { label: "Current", tone: "success" },
  past_due: { label: "Past due", tone: "danger" },
  restructured: { label: "Restructured", tone: "warning" },
  paid: { label: "Fully paid", tone: "muted" },
  written_off: { label: "Closed", tone: "muted" },
};

export const SCHEDULE_STATUS: Record<ScheduleRowStatus, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "success" },
  partial: { label: "Partly paid", tone: "warning" },
  due: { label: "Due", tone: "info" },
  overdue: { label: "Overdue", tone: "danger" },
  upcoming: { label: "Upcoming", tone: "muted" },
};

export const STATEMENT_KINDS: Record<StatementKind, string> = {
  consolidated: "All my accounts",
  loan: "A loan",
  savings: "A savings account",
  share_capital: "Share capital",
};

/** A server amount as a number; absent or unparseable reads as 0. */
export function toAmount(value: Money | null | undefined): number {
  return parseFloat(String(value ?? 0)) || 0;
}

/** Share of the loan paid so far, 0–100, rounded down so it never shows 100 early. */
export function paidPercent(totalPaid: Money, totalPayable: Money): number {
  const payable = toAmount(totalPayable);
  if (payable <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((toAmount(totalPaid) / payable) * 100)));
}

/** A loan the member can still pay toward online. */
export function isPayable(status: PortalLoanStatus): boolean {
  return status === "active" || status === "past_due" || status === "restructured";
}

/**
 * Why an online payment amount is refused, or null when it is fine. The cap is
 * the outstanding balance; the server re-checks both.
 */
export function gcashAmountProblem(amount: number, outstanding: Money, minimum = 1): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter the amount you want to pay.";
  if (amount < minimum) return `The smallest online payment is ₱${minimum}.`;
  if (Math.round(amount * 100) !== amount * 100) return "Use at most two decimal places.";
  if (amount > toAmount(outstanding)) return "The amount is more than what you still owe on this loan.";
  return null;
}

export type StatementPreset = "this_month" | "last_month" | "last_3_months" | "this_year";

export const STATEMENT_PRESETS: Record<StatementPreset, string> = {
  this_month: "This month",
  last_month: "Last month",
  last_3_months: "Last 3 months",
  this_year: "This year",
};

/** The `from`/`to` dates (YYYY-MM-DD, local) a preset covers as of `today`. */
export function presetRange(preset: StatementPreset, today: Date): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const to = formatDateISO(today);
  switch (preset) {
    case "this_month":
      return { from: formatDateISO(new Date(y, m, 1)), to };
    case "last_month":
      return { from: formatDateISO(new Date(y, m - 1, 1)), to: formatDateISO(new Date(y, m, 0)) };
    case "last_3_months":
      return { from: formatDateISO(new Date(y, m - 2, 1)), to };
    case "this_year":
      return { from: formatDateISO(new Date(y, 0, 1)), to };
  }
}

/** Why a custom period is refused, or null. Dates are YYYY-MM-DD so they compare as strings. */
export function periodProblem(from: string, to: string, today: string): string | null {
  if (!from || !to) return "Choose both a start and an end date.";
  if (from > to) return "The start date is after the end date.";
  if (to > today) return "The end date cannot be in the future.";
  const [fy, fm, fd] = from.split("-").map(Number);
  const yearLater = formatDateISO(new Date(fy + 1, fm - 1, fd));
  if (to >= yearLater) return "A statement can cover at most one year.";
  return null;
}

/** "statement-loan-LN-0012-2026-01-01-to-2026-03-31.pdf" */
export function statementFilename(kind: StatementKind, from: string, to: string, label?: string): string {
  const safe = label ? `-${label.replace(/[^A-Za-z0-9-]+/g, "-")}` : "";
  return `statement-${kind.replace("_", "-")}${safe}-${from}-to-${to}.pdf`;
}
