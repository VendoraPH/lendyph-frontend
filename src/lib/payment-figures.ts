/**
 * The Record Payment figures, read from the server; nothing is worked out
 * here.
 *
 * - `amount_due_now` on the loan (LoanResource): what a payment must be today
 *   to clear the insurance premium owed plus the first open period in full,
 *   penalty included, with its parts. Null unless the loan takes payments.
 * - `balance_after` on the payment preview: the loan's outstanding balance,
 *   insurance premium owed included, once the payment posts.
 *
 * Pure, so it runs under `tsx --test`.
 */
import { toNumber } from "@/lib/report-format";

export interface AmountDueNow {
  amount: number;
  insurance: number;
  principal: number;
  interest: number;
  penalty: number;
  shareCapitalBuildUp: number;
  /** Null when no period is open (only premium is owed). */
  periodNumber: number | null;
  scheduleId: number | null;
}

function record(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function figure(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  return toNumber(raw);
}

function idOrNull(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) ? raw : null;
}

/** The loan's `amount_due_now`, or null when it is missing or any figure is unreadable. */
export function readAmountDueNow(raw: unknown): AmountDueNow | null {
  const d = record(raw);
  if (!d) return null;
  const amount = figure(d.amount);
  const insurance = figure(d.insurance);
  const principal = figure(d.principal);
  const interest = figure(d.interest);
  const penalty = figure(d.penalty);
  const shareCapitalBuildUp = figure(d.share_capital_build_up);
  if (
    amount === null ||
    insurance === null ||
    principal === null ||
    interest === null ||
    penalty === null ||
    shareCapitalBuildUp === null
  ) {
    return null;
  }
  return {
    amount,
    insurance,
    principal,
    interest,
    penalty,
    shareCapitalBuildUp,
    periodNumber: idOrNull(d.period_number),
    scheduleId: idOrNull(d.schedule_id),
  };
}

export interface AmountDuePart {
  key: "insurance" | "penalty" | "interest" | "principal" | "share_capital_build_up";
  label: string;
  amount: number;
}

/**
 * The amount due now's parts in the order a payment takes them: insurance
 * premium owed (only when there is some), penalty, interest, principal, then
 * the share capital build-up (only when there is some).
 */
export function amountDueNowParts(due: AmountDueNow | null): AmountDuePart[] {
  if (due === null) return [];
  const parts: AmountDuePart[] = [];
  if (due.insurance > 0) parts.push({ key: "insurance", label: "Insurance premium", amount: due.insurance });
  parts.push({ key: "penalty", label: "Penalty", amount: due.penalty });
  parts.push({ key: "interest", label: "Interest", amount: due.interest });
  parts.push({ key: "principal", label: "Principal", amount: due.principal });
  if (due.shareCapitalBuildUp > 0) {
    parts.push({ key: "share_capital_build_up", label: "Share Capital Build-Up", amount: due.shareCapitalBuildUp });
  }
  return parts;
}

/**
 * How a payment stands against the server's amount due now, to the centavo:
 * `covers` it, falls short of it (`partial`), or `unknown` when the server
 * sent none.
 */
export function paymentAgainstDueNow(
  amount: number,
  due: AmountDueNow | null,
): "covers" | "partial" | "unknown" {
  if (due === null) return "unknown";
  return Math.round(amount * 100) < Math.round(due.amount * 100) ? "partial" : "covers";
}

/** Whether the server's amount due now includes an open period. */
export function dueNowHasOpenPeriod(due: AmountDueNow | null): boolean {
  return due !== null && (due.periodNumber !== null || due.scheduleId !== null);
}

/** The preview's outstanding balance after the payment, or null when not sent. */
export function previewBalanceAfter(preview: { balance_after?: unknown; [key: string]: unknown } | null | undefined): number | null {
  return figure(preview?.balance_after);
}

/** The preview's outstanding balance before the payment, or null when not sent. */
export function previewBalanceBefore(preview: { balance_before?: unknown; [key: string]: unknown } | null | undefined): number | null {
  return figure(preview?.balance_before);
}
