/**
 * The Record Payment figures, read from the server; nothing is worked out
 * here.
 *
 * - `amount_due_now` on the loan (LoanResource): what a payment must be today
 *   to clear the insurance premium owed plus every open period due on or
 *   before today (the first open period when none is due yet), penalty
 *   included, with its parts. Its ids are the first period covered and
 *   `last_period_number` the last. Null unless the loan takes payments.
 *   It is as of today only: for another payment date it is not shown.
 * - `payment_badge` on the dated payment preview: whether that amount on that
 *   date is partial, premium owed counted.
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
  /** The first period covered; null when no period is open (only premium is owed). */
  periodNumber: number | null;
  /** The last period covered; equal to `periodNumber` for one period. */
  lastPeriodNumber: number | null;
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
    lastPeriodNumber: idOrNull(d.last_period_number),
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
 * The amount due now for a payment dated `paymentDateISO`: the server's
 * figure is as of today, so any other date has none (a dash, no quick fill).
 */
export function dueNowOnDate(
  due: AmountDueNow | null,
  paymentDateISO: string,
  todayISO: string,
): AmountDueNow | null {
  return paymentDateISO === todayISO ? due : null;
}

/**
 * The tiles both Record Payment screens show: the amount due now's parts, or
 * the same dashed Penalty, Interest and Principal when there is no figure.
 */
export function dueNowTiles(due: AmountDueNow | null): { key: string; label: string; amount: number | null }[] {
  if (due !== null) return amountDueNowParts(due);
  return [
    { key: "penalty", label: "Penalty", amount: null },
    { key: "interest", label: "Interest", amount: null },
    { key: "principal", label: "Principal", amount: null },
  ];
}

/** Whether the amount due now covers more than one period. */
export function dueNowIsRange(due: AmountDueNow | null): boolean {
  return (
    due !== null &&
    due.periodNumber !== null &&
    due.lastPeriodNumber !== null &&
    due.lastPeriodNumber !== due.periodNumber
  );
}

/** "Period 2", "Periods 2–4", or null when no period is open. */
export function dueNowPeriodLabel(due: AmountDueNow | null): string | null {
  if (due === null || due.periodNumber === null) return null;
  return dueNowIsRange(due) ? `Periods ${due.periodNumber}–${due.lastPeriodNumber}` : `Period ${due.periodNumber}`;
}

/**
 * Whether an upon-maturity payment asks to extend first, from the server's
 * dated preview for exactly this amount and date: `prompt` when its badge is
 * partial, `post` otherwise, `unknown` (don't post) while that preview is
 * missing, stale or has no badge. With no period open there is nothing to
 * extend.
 */
export function shouldPromptExtend(input: {
  hasOpenPeriod: boolean;
  preview: { payment_badge?: { type?: unknown } | null } | null;
  previewIsCurrent: boolean;
}): "prompt" | "post" | "unknown" {
  if (!input.hasOpenPeriod) return "post";
  const type = input.previewIsCurrent ? input.preview?.payment_badge?.type : undefined;
  if (typeof type !== "string") return "unknown";
  return type === "partial" ? "prompt" : "post";
}

/** Which request a payment preview answers: its amount and payment date. */
export function previewRequestKey(amount: number, paymentDateISO: string): string {
  return `${amount}|${paymentDateISO}`;
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
