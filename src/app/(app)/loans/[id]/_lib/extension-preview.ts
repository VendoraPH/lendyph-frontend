/**
 * The Extend dialog's figures, picked from the server's
 * `GET /loans/{id}/extension-preview` answer. Nothing is calculated here.
 * Pure, so it runs under `tsx --test`.
 */
import { getErrorMessage } from "@/lib/api-error";
import type { ExtensionInterestOption } from "@/types/loan";

/**
 * What "pay" collects before the loan extends: the insurance premium owed,
 * the late penalty and all interest outstanding, so only principal moves.
 * Every figure is the server's `collect_now`, as sent: null when it is
 * missing or unreadable (a dash), never worked out here.
 */
export interface CollectNowView {
  /** Total collected now (`amount`). */
  amount: number | null;
  /** Insurance premium owed on the loan, taken first. 0 when none is owed or none was sent. */
  insurancePart: number | null;
  penaltyPart: number | null;
  interestPart: number | null;
}

export interface ExtensionPreviewView {
  option: ExtensionInterestOption;
  /** What "pay" collects before the loan extends. Null for "defer", which collects nothing. */
  collectNow: CollectNowView | null;
  carryInterest: number;
  freshInterest: number;
  newInterestDue: number;
  newTotalDue: number;
  /** `YYYY-MM-DD`. */
  newDueDate: string;
  /**
   * How many cycles the due date moves, each charged one cycle's
   * interest (already inside `freshInterest`). Null when the server sent
   * none, which shows a dash.
   */
  cycles: number | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A decimal as a decimal cast sends it: digits, an optional sign and fraction. */
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * A figure as sent: a finite number, or a plain decimal string. Anything
 * else ("0x10", "1e3", "Infinity", "") is unreadable and shows a dash, never
 * a number JavaScript happens to read out of it.
 */
function figure(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string" || !DECIMAL_PATTERN.test(raw)) return null;
  return Number(raw);
}

function record(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

/**
 * The server's preview figures for `option`, or null when the answer is not
 * for that option or any new-period figure is missing or unreadable. The
 * parts of what "pay" collects are each a dash when missing instead, and
 * Confirm waits for the total (canConfirmExtension).
 */
export function readExtensionPreview(
  data: unknown,
  option: ExtensionInterestOption,
): ExtensionPreviewView | null {
  const d = record(data);
  if (!d || d.interest_option !== option) return null;
  const collect = record(d.collect_now);
  // An answer without an insurance part collects no premium (0); sent but
  // unreadable shows a dash like any other part.
  const rawInsurancePart = collect?.insurance_part;
  const collectNow: CollectNowView = {
    amount: figure(collect?.amount),
    insurancePart: rawInsurancePart === undefined || rawInsurancePart === null ? 0 : figure(rawInsurancePart),
    penaltyPart: figure(collect?.penalty_part),
    interestPart: figure(collect?.interest_part),
  };
  const carryInterest = figure(d.carry_interest);
  const freshInterest = figure(d.fresh_interest);
  const newInterestDue = figure(d.new_interest_due);
  const newTotalDue = figure(d.new_total_due);
  const newDueDate = typeof d.new_due_date === "string" && DATE_PATTERN.test(d.new_due_date) ? d.new_due_date : null;
  // Optional: an answer without it shows a dash. Sent, it must be a whole
  // number of cycles, at least one.
  const rawCycles = d.cycles;
  const sentCycles = rawCycles === undefined || rawCycles === null ? null : figure(rawCycles);
  const cyclesUnreadable =
    rawCycles !== undefined && rawCycles !== null && (sentCycles === null || !Number.isInteger(sentCycles) || sentCycles < 1);
  if (
    carryInterest === null ||
    freshInterest === null ||
    newInterestDue === null ||
    newTotalDue === null ||
    newDueDate === null ||
    cyclesUnreadable
  ) {
    return null;
  }
  return {
    option,
    collectNow: option === "pay" ? collectNow : null,
    carryInterest,
    freshInterest,
    newInterestDue,
    newTotalDue,
    newDueDate,
    cycles: sentCycles,
  };
}

/**
 * What one extension cycle is called. A monthly or upon-maturity loan moves
 * by anchored months; any other frequency moves by its own period, which is
 * called a cycle (each still charged one cycle's interest).
 */
export type ExtensionCycleUnit = "month" | "cycle";

export function extensionCycleUnit(frequency: string | null | undefined): ExtensionCycleUnit {
  return frequency === "monthly" || frequency === "upon_maturity" ? "month" : "cycle";
}

/** How far the due date moves, e.g. "6 months" or "1 month"; a dash when not sent. */
export function extensionCyclesLabel(cycles: number | null, unit: ExtensionCycleUnit): string {
  if (cycles === null) return "—";
  return `${cycles} ${unit}${cycles === 1 ? "" : "s"}`;
}

/**
 * What the extension moves and adds to the new period, from the server's
 * cycle count, or null when the server sent none (the dialog then says
 * nothing about it). Shown with the new period's figures, never under what
 * "pay" collects now: that interest is owed later, not collected now.
 */
export function extensionCyclesSentence(cycles: number | null, unit: ExtensionCycleUnit): string | null {
  if (cycles === null) return null;
  const moved = extensionCyclesLabel(cycles, unit);
  return `Moves the due date ${moved}: interest for ${moved} is added to the new period.`;
}

/**
 * The dialog's opening line. The due date always moves at least one cycle,
 * even on a loan not yet due. The overdue clause shows only once the server
 * sends `cycles`, so it can't describe a move a server without it won't make.
 */
export function extensionMoveDescription(cycles: number | null, unit: ExtensionCycleUnit): string {
  const base = `This moves the loan's due date one ${unit} forward.`;
  if (cycles === null) return base;
  return `${base} When the loan is overdue, it moves as many ${unit}s as needed to land after today, and each ${unit} moved is charged interest.`;
}

/** The label of the fresh interest row: the cycles it covers, when sent. */
export function freshInterestLabel(cycles: number | null, unit: ExtensionCycleUnit): string {
  return cycles === null ? "New interest charged" : `Interest for ${extensionCyclesLabel(cycles, unit)}`;
}

/**
 * The rows of what "pay" collects, in the order the server takes them: the
 * insurance premium owed (only when above ₱0.00, or a dash when sent but
 * unreadable), the late penalty, then the interest. Each figure is as sent;
 * null shows a dash. The total is `amount`, shown on its own row.
 */
export function collectNowRows(collectNow: CollectNowView | null): { label: string; amount: number | null }[] {
  if (collectNow === null) return [];
  const rows: { label: string; amount: number | null }[] = [];
  if (collectNow.insurancePart === null || collectNow.insurancePart > 0) {
    rows.push({ label: "Insurance premium", amount: collectNow.insurancePart });
  }
  rows.push({ label: "Late penalty", amount: collectNow.penaltyPart });
  rows.push({ label: "Interest", amount: collectNow.interestPart });
  return rows;
}

/**
 * Whether Confirm Extension may be pressed: a preview has answered and, on
 * "pay", it says what is collected in total. A missing part only shows a
 * dash, but a missing total would collect an amount nobody has seen.
 */
export function canConfirmExtension(preview: ExtensionPreviewView | null): boolean {
  return preview !== null && (preview.collectNow === null || preview.collectNow.amount !== null);
}

/** What a failed preview says when the server gives no usable reason. */
export const EXTENSION_PREVIEW_FALLBACK = "We couldn't preview this extension. Please try again.";

/** One answer from the server, tagged with the request it answers. */
export interface ExtensionPreviewAnswer {
  key: string;
  preview: ExtensionPreviewView | null;
  error: string | null;
  /** True when the request itself failed (worth a toast), not just unreadable. */
  failed: boolean;
}

/** The request the open dialog makes now; null while it is closed. */
export function extensionPreviewKey(
  request: { loanId: number; option: ExtensionInterestOption; round: number } | null,
): string | null {
  return request === null ? null : JSON.stringify([request.loanId, request.option, request.round]);
}

/**
 * A settled request as the dialog records it, or null when the request was
 * aborted (switched away from or closed), so it neither shows nor reports.
 */
export function extensionPreviewAnswer(
  key: string,
  option: ExtensionInterestOption,
  outcome: { data: unknown } | { error: unknown },
  aborted: boolean,
): ExtensionPreviewAnswer | null {
  if (aborted) return null;
  if ("error" in outcome) {
    return { key, preview: null, error: getErrorMessage(outcome.error, EXTENSION_PREVIEW_FALLBACK), failed: true };
  }
  const preview = readExtensionPreview(outcome.data, option);
  return {
    key,
    preview,
    error: preview === null ? "The server's extension preview could not be read." : null,
    failed: false,
  };
}

/**
 * What the dialog shows for the request made now: the answer only when it
 * answers that request (same loan, option and round), loading until then.
 */
export function extensionPreviewState(
  key: string | null,
  answer: ExtensionPreviewAnswer | null,
): { loading: boolean; preview: ExtensionPreviewView | null; error: string | null } {
  const current = key !== null && answer?.key === key ? answer : null;
  return {
    loading: key !== null && current === null,
    preview: current?.preview ?? null,
    error: current?.error ?? null,
  };
}
