import { INTEREST_METHOD_LABELS } from "@/constants";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { formatDateISO } from "@/lib/format";
import type { LoanFormPreview, LoanFormPreviewRequest } from "@/types";
import type { LoanFormPreviewDeduction, LoanProduct } from "@/types/loan";
import type { SelectedCollateral } from "./edit-collaterals";

/** A deduction input as the payload states it: a percentage's rate, a fixed item's pesos. */
export interface StatedDeduction {
  name: string;
  amount: number;
  type: "percentage" | "fixed";
}

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
  /**
   * The deductions the save would state, or null when it states none and the
   * server charges the product's own fees.
   */
  deductions: readonly StatedDeduction[] | null;
}

/** A positive figure typed into the form, parsed as the submit parses it. */
function positive(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * The `POST /loans/preview` body for the form as it stands, or null when there
 * is nothing to preview: no product chosen and no collateral attached.
 *
 * Fields the form has no usable value for are left out; the server works out
 * whatever sections it can from the rest — the maturity date needs no
 * principal, the deductions no term. The figures are parsed exactly as the
 * submit parses them, and the deductions are the inputs the submit sends, so
 * the preview describes the loan that would be saved.
 */
export function loanPreviewRequest(inputs: LoanPreviewInputs): LoanFormPreviewRequest | null {
  const productId = inputs.productId ? Number(inputs.productId) : undefined;
  const principal = positive(parseFloat(inputs.principalAmount));
  const rate = positive(parseFloat(inputs.interestRate));
  const term = positive(parseInt(inputs.termValue));
  const scb = positive(parseFloat(inputs.scbAmount));
  const frequency = inputs.paymentFrequency ?? undefined;
  const startDate = inputs.releaseDate ? formatDateISO(inputs.releaseDate) : undefined;

  if (productId === undefined && inputs.collaterals.length === 0) return null;

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
    ...(inputs.deductions !== null && {
      deductions: inputs.deductions.map((d) => ({ name: d.name, amount: d.amount, type: d.type })),
    }),
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

/** An interest method by name ("fixed" is the legacy spelling of "straight"). */
export function interestMethodLabel(method: string): string {
  const value = method === "fixed" ? "straight" : method;
  return INTEREST_METHOD_LABELS[value] ?? method;
}

/**
 * The Interest Type the form shows, read-only. The server builds every loan
 * with its product's interest method — a new loan snapshots it from the
 * product, and a sent `interest_method` is ignored — so there is nothing to
 * choose. An edit always shows the loan's stored method: `PUT /loans/{id}`
 * keeps the loan's product whatever the form picks, so the method stays the
 * loan's own. Null with neither.
 */
export function formInterestMethod({
  product,
  storedMethod,
}: {
  product: Pick<LoanProduct, "interest_method"> | null;
  /** The loan's own method when editing; null for a new application. */
  storedMethod: string | null;
}): string | null {
  if (storedMethod) return storedMethod === "fixed" ? "straight" : storedMethod;
  return product?.interest_method ?? null;
}

/**
 * The server's peso amount for one deduction the form states, or null when the
 * preview has no figure for it. Matched on name and type, and on position
 * among the inputs sharing both, so two items with one name each get their
 * own figure and a missing item is never filled from its neighbour.
 */
export function previewDeductionAmount(
  items: readonly LoanFormPreviewDeduction[] | null | undefined,
  inputs: readonly StatedDeduction[],
  input: StatedDeduction | undefined,
): number | null {
  if (!items || !input) return null;
  const index = inputs.indexOf(input);
  if (index < 0) return null;
  const same = (d: { name: string; type: string }) => d.name === input.name && d.type === input.type;
  const occurrence = inputs.slice(0, index).filter(same).length;
  return items.filter(same)[occurrence]?.amount ?? null;
}
