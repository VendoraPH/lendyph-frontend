import { loanService, type LoanApplicationPayload } from "@/services/loan.service";
import type { Loan } from "@/types";
import { editedCollaterals, type SelectedCollateral } from "./edit-collaterals";

/**
 * Saves an edit of a loan application in one `PUT /loans/{id}`
 * (`loanService.update`), collaterals included, each by id only: the server
 * sets the value each is held at (decision 11a).
 *
 * The server reconciles the collateral list inside the update, so there is no
 * attach or detach call here. The page used to make them itself after the
 * update, from a list it might not have finished loading, and detached every
 * attached collateral it had not loaded.
 *
 * `attached` is what the loan held when the form loaded, or null when the form
 * must not state the loan's collaterals (see `editedCollaterals`).
 */
export function saveLoanEdit(
  loanId: number,
  payload: Omit<LoanApplicationPayload, "collaterals">,
  selected: readonly SelectedCollateral[],
  attached: readonly SelectedCollateral[] | null,
): Promise<Loan> {
  return loanService.update(loanId, { ...payload, ...editedCollaterals(selected, attached) });
}
