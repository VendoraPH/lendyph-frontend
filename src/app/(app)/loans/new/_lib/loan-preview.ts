import { INTEREST_METHOD_LABELS } from "@/constants";
import { getErrorMessage, httpStatusOf, type ApiErrorBody } from "@/lib/api-error";
import { formatDateISO } from "@/lib/format";
import type { RestructurePreview } from "@/lib/loan-restructure";
import type { LoanFormPreview, LoanFormPreviewRequest } from "@/types";
import type { LoanFormPreviewDeduction, LoanProduct } from "@/types/loan";
import { pledgedCollaterals, type PledgedCollateral, type SelectedCollateral } from "./edit-collaterals";

/**
 * `POST /loans/preview` as this form sends it. The server values each
 * collateral itself, from the member's register (decision 11a): a collateral
 * goes up by id only, with the member it belongs to, and never a value. A
 * restructure also names its source loan, and the server answers with the
 * shortfall (decision 8a).
 *
 * Declared here rather than in the shared `LoanFormPreviewRequest`, which still
 * carries a `snapshot_value` the server now ignores.
 */
export type FormPreviewRequest = Omit<LoanFormPreviewRequest, "collaterals"> & {
  /** Sent whenever `collaterals` is: the server values them from this member's register. */
  borrower_id?: number;
  /** A restructure's source loan, so the answer carries `restructure`. */
  source_loan_id?: number;
  collaterals?: PledgedCollateral[];
};

/**
 * The preview's answer: the shared shape, plus the restructure section the
 * server adds when the request named a `source_loan_id`.
 */
export type FormPreview = LoanFormPreview & {
  restructure?: RestructurePreview | null;
};

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
  /** The member the collaterals belong to, or null before one is chosen. */
  borrowerId: number | null;
  /** The loan a restructure replaces; absent or null for a new application. */
  sourceLoanId?: number | null;
  /** Only each row's collateral id goes up; the figure a row shows never does. */
  collaterals: readonly Pick<SelectedCollateral, "collateral">[];
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
 * is nothing to preview: no product chosen and no collateral to value.
 *
 * Collaterals go up by id with the member's id, which the server needs to
 * value them. Until a member is chosen neither is sent: the server could not
 * value the rows.
 *
 * Fields the form has no usable value for are left out; the server works out
 * whatever sections it can from the rest — the maturity date needs no
 * principal, the deductions no term. The figures are parsed exactly as the
 * submit parses them, and the deductions are the inputs the submit sends, so
 * the preview describes the loan that would be saved.
 */
export function loanPreviewRequest(inputs: LoanPreviewInputs): FormPreviewRequest | null {
  const productId = inputs.productId ? Number(inputs.productId) : undefined;
  const principal = positive(parseFloat(inputs.principalAmount));
  const rate = positive(parseFloat(inputs.interestRate));
  const term = positive(parseInt(inputs.termValue));
  const scb = positive(parseFloat(inputs.scbAmount));
  const frequency = inputs.paymentFrequency ?? undefined;
  const startDate = inputs.releaseDate ? formatDateISO(inputs.releaseDate) : undefined;
  const borrowerId = inputs.borrowerId ?? undefined;
  // The shortfall needs a principal to measure, so a restructure names its
  // source loan only once one above 0 is entered.
  const sourceLoanId = principal !== undefined ? inputs.sourceLoanId ?? undefined : undefined;
  const valuable = borrowerId !== undefined && inputs.collaterals.length > 0;

  if (productId === undefined && !valuable) return null;

  return {
    ...(borrowerId !== undefined && { borrower_id: borrowerId }),
    ...(sourceLoanId !== undefined && { source_loan_id: sourceLoanId }),
    ...(productId !== undefined && { loan_product_id: productId }),
    ...(principal !== undefined && { principal_amount: principal }),
    ...(rate !== undefined && { interest_rate: rate }),
    ...(term !== undefined && { term }),
    ...(frequency !== undefined && { frequency }),
    ...(startDate !== undefined && { start_date: startDate }),
    ...(scb !== undefined && { scb_amount: scb }),
    ...(borrowerId !== undefined && { collaterals: pledgedCollaterals(inputs.collaterals) }),
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
  | { status: "ready"; preview: FormPreview }
  | { status: "error"; message: string; refused?: RefusedCollateral | null };

type SettledView = Extract<LoanPreviewView, { status: "ready" | "error" }>;

/** How one preview request ended, keyed by the body and attempt it was for. */
export interface LoanPreviewOutcome {
  key: string;
  attempt: number;
  view: SettledView;
}

/** One request body as a comparable key: equal bodies, equal keys. */
export function loanPreviewKey(request: FormPreviewRequest | null): string | null {
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

/** A collateral the preview refused (422): which row, and the server's reason. */
export interface RefusedCollateral {
  /** The row's position in the request's `collaterals`, or null when the error names none. */
  index: number | null;
  /** The server's reason when it reads as copy for a person, else null. */
  reason: string | null;
}

/** A sentence for a person, not a blank or an identifier such as `share_capital_hidden`. */
function readable(message: unknown): string | null {
  if (typeof message !== "string") return null;
  const text = message.trim();
  return /\s/.test(text) ? text : null;
}

/**
 * The collateral a 422 refused (`collaterals`, `collaterals.2.collateral_id`,
 * ...), with the server's first reason, or null when the failure isn't a
 * collateral refusal.
 */
export function refusedCollateral(err: unknown): RefusedCollateral | null {
  if (httpStatusOf(err) !== 422) return null;
  const errors = (err as { response?: { data?: ApiErrorBody } }).response?.data?.errors;
  if (!errors || typeof errors !== "object") return null;
  const entry = Object.entries(errors).find(
    ([field]) => field === "collaterals" || field.startsWith("collaterals."),
  );
  if (!entry) return null;
  const [field, messages] = entry;
  const position = /^collaterals\.(\d+)/.exec(field);
  const refused = Array.isArray(messages) ? messages : [];
  return {
    index: position ? Number(position[1]) : null,
    reason: readable(refused[0]),
  };
}

/**
 * What the form says about a refused collateral. The server's reason, alone,
 * when it gave a readable one: a 422 on a collateral isn't always about the
 * role. Without one, it is in practice a share capital collateral whose
 * balance the role may not see (`share_capital:view`), since valuing it would
 * reveal the balance. Removing the row is suggested only when the user can
 * remove it; otherwise someone who can value it has to finish the loan.
 */
export function refusedCollateralMessage(refused: RefusedCollateral, removable: boolean): string {
  if (refused.reason) return refused.reason;
  const lead =
    "A share capital collateral on this form can't be valued for your role: it needs Share Capital: View.";
  return removable
    ? `${lead} Remove it to see the loan figures.`
    : `${lead} Ask a user with Share Capital: View to complete this loan.`;
}

/**
 * Why a preview failed, as the form says it. A refused collateral is worded
 * as if its row can be removed; `previewFailureText` words it for the row.
 */
export function loanPreviewFailureMessage(err: unknown): string {
  if (httpStatusOf(err) === 403) return "Your role can't preview loan terms.";
  const refused = refusedCollateral(err);
  if (refused) return refusedCollateralMessage(refused, true);
  return getErrorMessage(err, "Please try again.");
}

/** A failed preview's view, as `loanPreviewView` gives it. */
export type FailedPreviewView = Extract<LoanPreviewView, { status: "error" }>;

/** The failed view for a thrown preview error. */
export function failedPreviewView(err: unknown): FailedPreviewView {
  return { status: "error", message: loanPreviewFailureMessage(err), refused: refusedCollateral(err) };
}

/**
 * The failure text for the form's own rows: a refused collateral says whether
 * to remove it, by whether `isRemovable` lets the user remove that row. With
 * no row named, removing is suggested only when every row can be removed.
 */
export function previewFailureText<Row>(
  view: FailedPreviewView,
  rows: readonly Row[],
  isRemovable: (row: Row) => boolean,
): string {
  if (!view.refused) return view.message;
  const { index } = view.refused;
  const removable =
    index === null
      ? rows.length > 0 && rows.every(isRemovable)
      : index < rows.length && isRemovable(rows[index]);
  return refusedCollateralMessage(view.refused, removable);
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
