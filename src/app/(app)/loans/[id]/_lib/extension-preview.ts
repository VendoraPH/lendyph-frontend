/**
 * The Extend dialog's figures, picked from the server's
 * `GET /loans/{id}/extension-preview` answer. Nothing is calculated here.
 * Dependency-free, so it runs under `tsx --test`.
 */
import type { ExtensionInterestOption } from "@/types/loan";

export interface ExtensionPreviewView {
  option: ExtensionInterestOption;
  /**
   * What "pay" collects before the loan extends. Null for "defer", which
   * collects nothing. `penaltyPart` is null when no penalty is collected.
   */
  collectNow: { amount: number; penaltyPart: number | null; interestPart: number } | null;
  carryInterest: number;
  freshInterest: number;
  newInterestDue: number;
  newTotalDue: number;
  /** `YYYY-MM-DD`. */
  newDueDate: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function figure(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function record(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

/**
 * The server's preview figures for `option`, or null when the answer is not
 * for that option or any figure is missing or unreadable.
 */
export function readExtensionPreview(
  data: unknown,
  option: ExtensionInterestOption,
): ExtensionPreviewView | null {
  const d = record(data);
  if (!d || d.interest_option !== option) return null;
  const collect = record(d.collect_now);
  const amount = figure(collect?.amount);
  const penaltyPart = figure(collect?.penalty_part);
  const interestPart = figure(collect?.interest_part);
  const carryInterest = figure(d.carry_interest);
  const freshInterest = figure(d.fresh_interest);
  const newInterestDue = figure(d.new_interest_due);
  const newTotalDue = figure(d.new_total_due);
  const newDueDate = typeof d.new_due_date === "string" && DATE_PATTERN.test(d.new_due_date) ? d.new_due_date : null;
  if (
    amount === null ||
    penaltyPart === null ||
    interestPart === null ||
    carryInterest === null ||
    freshInterest === null ||
    newInterestDue === null ||
    newTotalDue === null ||
    newDueDate === null
  ) {
    return null;
  }
  return {
    option,
    collectNow: option === "pay" ? { amount, penaltyPart: penaltyPart > 0 ? penaltyPart : null, interestPart } : null,
    carryInterest,
    freshInterest,
    newInterestDue,
    newTotalDue,
    newDueDate,
  };
}
