import { INTEREST_TYPE_OPTIONS } from "@/constants";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { formatDateISO } from "@/lib/format";
import type { LoanFormPreview, LoanFormPreviewRequest } from "@/types";
import type { SelectedCollateral } from "./edit-collaterals";

/** The loan form's fields that `POST /loans/preview` is asked about. */
export interface LoanPreviewInputs {
  productId: string | null;
  principalAmount: string;
  interestRate: string;
  termValue: string;
  paymentFrequency: string | null;
  releaseDate: Date | undefined;
  scbAmount: string;
  collaterals: readonly SelectedCollateral[];
}

/** A positive figure typed into the form, parsed as the submit parses it. */
function positive(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * The `POST /loans/preview` body for the form as it stands, or null when there
 * is nothing to preview: no collateral attached, and the schedule's inputs
 * (product, principal, rate, term, frequency, release date) not all known.
 *
 * Fields the form has no usable value for are left out; the server works out
 * whatever sections it can from the rest. The figures are parsed exactly as
 * the submit parses them, so the preview describes the loan that would be
 * saved.
 */
export function loanPreviewRequest(inputs: LoanPreviewInputs): LoanFormPreviewRequest | null {
  const productId = inputs.productId ? Number(inputs.productId) : undefined;
  const principal = positive(parseFloat(inputs.principalAmount));
  const rate = positive(parseFloat(inputs.interestRate));
  const term = positive(parseInt(inputs.termValue));
  const scb = positive(parseFloat(inputs.scbAmount));
  const frequency = inputs.paymentFrequency ?? undefined;
  const startDate = inputs.releaseDate ? formatDateISO(inputs.releaseDate) : undefined;

  const scheduleKnown =
    productId !== undefined &&
    principal !== undefined &&
    rate !== undefined &&
    term !== undefined &&
    frequency !== undefined &&
    startDate !== undefined;
  if (!scheduleKnown && inputs.collaterals.length === 0) return null;

  return {
    ...(productId !== undefined && { loan_product_id: productId }),
    ...(principal !== undefined && { principal_amount: principal }),
    ...(rate !== undefined && { interest_rate: rate }),
    ...(term !== undefined && { term }),
    ...(frequency !== undefined && { frequency }),
    ...(startDate !== undefined && { start_date: startDate }),
    ...(scb !== undefined && { scb_amount: scb }),
    collaterals: inputs.collaterals.map((c) => ({
      collateral_id: c.collateral.id,
      snapshot_value: c.snapshot_value,
    })),
  };
}

/**
 * Where the preview stands for the form as it is now.
 * - `idle`: nothing to preview (`loanPreviewRequest` gave null).
 * - `loading`: waiting for the preview of exactly these inputs.
 * - `ready`: the server's figures for exactly these inputs.
 * - `error`: the preview failed; the form shows no figures, never its own.
 */
export type LoanPreviewView =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: LoanFormPreview }
  | { status: "error"; message: string };

type SettledView = Extract<LoanPreviewView, { status: "ready" | "error" }>;

/** How one preview request ended, keyed by the body and attempt it was for. */
export interface LoanPreviewOutcome {
  key: string;
  attempt: number;
  view: SettledView;
}

/** One request body as a comparable key: equal bodies, equal keys. */
export function loanPreviewKey(request: LoanFormPreviewRequest | null): string | null {
  return request ? JSON.stringify(request) : null;
}

/**
 * The view for the form as it is now. An outcome for any other body or attempt
 * is stale, so the form shows loading rather than figures that belong to
 * inputs it no longer has.
 */
export function loanPreviewView(
  key: string | null,
  attempt: number,
  outcome: LoanPreviewOutcome | null,
): LoanPreviewView {
  if (key === null) return { status: "idle" };
  if (!outcome || outcome.key !== key || outcome.attempt !== attempt) {
    return { status: "loading" };
  }
  return outcome.view;
}

/** Why a preview failed, as the form says it. */
export function loanPreviewFailureMessage(err: unknown): string {
  if (httpStatusOf(err) === 403) return "Your role can't preview loan terms.";
  return getErrorMessage(err, "Please try again.");
}

/**
 * Whether the collateral summary says how far short of the principal the
 * collateral falls: only when the server says the loan is not fully secured
 * and a principal has been entered.
 */
export function showsShortBy(
  collateral: LoanFormPreview["collateral"],
  principal: number,
): boolean {
  return principal > 0 && collateral.security_status !== "secured";
}

/**
 * The interest method the server built the schedule with, as the form's
 * Interest Type select names it ("fixed" is the select's "straight").
 */
export function interestMethodLabel(method: string): string {
  const value = method === "fixed" ? "straight" : method;
  return INTEREST_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? method;
}
