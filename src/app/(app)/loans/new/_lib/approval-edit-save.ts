import { loanService, type LoanApplicationPayload, type LoanApprovalEditPayload } from "@/services/loan.service";
import type { Loan } from "@/types";
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
