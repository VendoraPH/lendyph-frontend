import { loanService, type LoanApplicationPayload } from "@/services/loan.service";
import { editedCollaterals, type SelectedCollateral } from "./edit-collaterals";

/**
 * Saves an edit of a loan application in one `PUT /loans/{id}`, collaterals
 * included.
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
  payload: LoanApplicationPayload,
  selected: readonly SelectedCollateral[],
  attached: readonly SelectedCollateral[] | null,
) {
  return loanService.update(loanId, { ...payload, ...editedCollaterals(selected, attached) });
}
