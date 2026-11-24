import { loanService, type LoanApplicationPayload, type LoanApprovalEditPayload } from "@/services/loan.service";
import type { Loan } from "@/types";
import { ratePeriodWord, readRateFrequency, readTermUnit, type RateFrequency, type TermUnit } from "@/lib/loan-terms";
import { editedCollaterals, type SelectedCollateral } from "./edit-collaterals";

/**
 * The loan form opened for the Chairman/Chairwoman's edit at their approval
 * step (`/loans/new?edit={id}&approval=1`, finish run round 2, decision 14).
 * It saves through `PATCH /loans/{id}/approval-edit`, previews through
 * `POST /loans/{id}/approval-edit/preview`, and returns to the approval card.
 */

/** Whether the URL opens that edit: `?approval=1` beside a loan to edit. */
export function isApprovalEdit(editLoanId: number | null, raw: string | null): boolean {
  return editLoanId !== null && raw === "1";
}

/** The form's fields the approval edit states as the form built them. */
const STATED_AS_BUILT = [
  "principal_amount",
  "term",
  "frequency",
  "interest_rate",
  "start_date",
  "deductions",
  "account_officer_id",
] as const satisfies readonly (keyof LoanApplicationPayload)[];

/** Two co-maker lists hold the same members, in any order. */
function sameMembers(a: readonly number[], b: readonly number[]): boolean {
  const before = new Set(b);
  const after = new Set(a);
  return before.size === after.size && [...after].every((id) => before.has(id));
}

/**
 * The body of `PATCH /loans/{id}/approval-edit`, from the form's own payload.
 *
 * - The member, the product and the policy exception are left out: they stay
 *   as they are, and the server refuses a change.
 * - The build-up and the purpose are always stated, so the Chair can clear
 *   either (the plain edit leaves out a ₱0.00 build-up and a blank purpose).
 * - The co-makers only when they changed, and only by a role that can pick
 *   members (`borrowers:view`); the server refuses the list otherwise.
 * - The collaterals only when they changed and the role may change them
 *   (`editedCollaterals`).
 * - The `version` read when the edit opened, so a loan changed since answers 409.
 */
export function approvalEditPayload(input: {
  payload: LoanApplicationPayload;
  version: string;
  scbAmount: number;
  purpose: string;
  coMakerIds: readonly number[];
  storedCoMakerIds: readonly number[];
  canPickMembers: boolean;
  selected: readonly SelectedCollateral[];
  attached: readonly SelectedCollateral[] | null;
}): LoanApprovalEditPayload {
  const body: LoanApprovalEditPayload = { version: input.version };
  for (const key of STATED_AS_BUILT) {
    if (input.payload[key] !== undefined) Object.assign(body, { [key]: input.payload[key] });
  }
  body.scb_amount = input.scbAmount;
  body.purpose = input.purpose.trim() === "" ? null : input.purpose.trim();
  if (input.canPickMembers && !sameMembers(input.coMakerIds, input.storedCoMakerIds)) {
    body.co_maker_ids = [...input.coMakerIds];
  }
  return { ...body, ...editedCollaterals(input.selected, input.attached) };
}

/** Saves the Chairman/Chairwoman's edit. The loan stays at their step. */
export function saveApprovalEdit(loanId: number, body: LoanApprovalEditPayload): Promise<Loan> {
  return loanService.approvalEdit(loanId, body);
}

/** What the save says, naming the step the loan still waits at. */
export function approvalEditSavedMessage(stepName: string | null): string {
  return stepName
    ? `It's still at the "${stepName}" step for you to approve or forward.`
    : "It's still at your approval step for you to approve or forward.";
}

/** Where the loan form's save goes. */
export type LoanFormSave =
  | { kind: "approval"; loanId: number; version: string }
  | { kind: "refused"; message: string }
  | { kind: "edit"; loanId: number }
  | { kind: "create" };

/** The approval edit can't be saved without the version it opened at. */
export const APPROVAL_EDIT_NOT_OPEN =
  "This edit didn't open at your approval step. Reload the loan and open the edit again.";

/**
 * Where the save goes: the approval edit with its version, the plain edit
 * (`PUT /loans/{id}`), or a new application. An approval edit with no version
 * is refused in words, never sent to the plain edit, which saves differently.
 */
export function loanFormSave(input: {
  inApproval: boolean;
  editLoanId: number | null;
  version: string | null;
}): LoanFormSave {
  if (input.inApproval) {
    return input.editLoanId !== null && input.version
      ? { kind: "approval", loanId: input.editLoanId, version: input.version }
      : { kind: "refused", message: APPROVAL_EDIT_NOT_OPEN };
  }
  return input.editLoanId !== null ? { kind: "edit", loanId: input.editLoanId } : { kind: "create" };
}

/** What a loan or a product counts its term in and quotes its rate per. */
interface TermsSource {
  term_unit?: string | null;
  interest_rate_frequency?: string | null;
}

/**
 * The term unit and rate period the form reads: an edit's own, copied from its
 * product when the loan was made, else the product's. When the product has
 * moved to another since, its range is in other terms, so the field can't
 * change here (the server refuses it in the same words).
 */
export function loanTermsBasis(
  loan: TermsSource | null,
  product: TermsSource | null,
): {
  termUnit: TermUnit;
  rateFrequency: RateFrequency;
  termUnitMoved: string | null;
  ratePeriodMoved: string | null;
} {
  const own = loan ?? product;
  const termUnit = readTermUnit(own?.term_unit);
  const rateFrequency = readRateFrequency(own?.interest_rate_frequency);
  const productUnit = product ? readTermUnit(product.term_unit) : termUnit;
  const productPeriod = product ? readRateFrequency(product.interest_rate_frequency) : rateFrequency;
  return {
    termUnit,
    rateFrequency,
    termUnitMoved:
      loan && productUnit !== termUnit
        ? `This loan's term is counted in ${termUnit}, but its product now counts ${productUnit}, so the term can't change here.`
        : null,
    ratePeriodMoved:
      loan && productPeriod !== rateFrequency
        ? `This loan's rate is quoted per ${ratePeriodWord(rateFrequency)}, but its product now quotes rates per ${ratePeriodWord(productPeriod)}, so the rate can't change here.`
        : null,
  };
}
