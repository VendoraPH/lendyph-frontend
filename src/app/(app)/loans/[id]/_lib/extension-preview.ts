/**
 * The Extend dialog's figures, picked from the server's
 * `GET /loans/{id}/extension-preview` answer. Nothing is calculated here.
 * Pure, so it runs under `tsx --test`.
 */
import { getErrorMessage } from "@/lib/api-error";
import type { ExtensionInterestOption } from "@/types/loan";

export interface CollectNowView {
  amount: number;
  /** Insurance premium owed on the loan, taken first. */
  insurancePart: number | null;
  penaltyPart: number | null;
  interestPart: number;
}

export interface ExtensionPreviewView {
  option: ExtensionInterestOption;
  /**
   * What "pay" collects before the loan extends. Null for "defer", which
   * collects nothing. `penaltyPart` is null when no penalty is collected, and
   * `insurancePart` when no insurance premium owed on the loan is.
   */
  collectNow: CollectNowView | null;
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
  // Optional: an answer without it collects no insurance premium. Sent but
  // unreadable is as bad as any other unreadable figure.
  const rawInsurancePart = collect?.insurance_part;
  const insurancePart = rawInsurancePart === undefined || rawInsurancePart === null ? 0 : figure(rawInsurancePart);
  const carryInterest = figure(d.carry_interest);
  const freshInterest = figure(d.fresh_interest);
  const newInterestDue = figure(d.new_interest_due);
  const newTotalDue = figure(d.new_total_due);
  const newDueDate = typeof d.new_due_date === "string" && DATE_PATTERN.test(d.new_due_date) ? d.new_due_date : null;
  if (
    amount === null ||
    penaltyPart === null ||
    interestPart === null ||
    insurancePart === null ||
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
    collectNow:
      option === "pay"
        ? {
            amount,
            penaltyPart: penaltyPart > 0 ? penaltyPart : null,
            interestPart,
            insurancePart: insurancePart > 0 ? insurancePart : null,
          }
        : null,
    carryInterest,
    freshInterest,
    newInterestDue,
    newTotalDue,
    newDueDate,
  };
}

/**
 * The parts of what "pay" collects, in the order the server takes them:
 * insurance premium owed, then late penalty, then interest. Empty when it is
 * interest alone, which the headline amount already says.
 */
export function collectNowParts(collectNow: CollectNowView | null): { label: string; amount: number }[] {
  if (collectNow === null || (collectNow.insurancePart === null && collectNow.penaltyPart === null)) return [];
  const parts: { label: string; amount: number }[] = [];
  if (collectNow.insurancePart !== null) parts.push({ label: "insurance premium", amount: collectNow.insurancePart });
  if (collectNow.penaltyPart !== null) parts.push({ label: "late penalty", amount: collectNow.penaltyPart });
  parts.push({ label: "interest", amount: collectNow.interestPart });
  return parts;
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
