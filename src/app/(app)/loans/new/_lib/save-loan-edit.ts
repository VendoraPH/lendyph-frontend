import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { LoanApplicationPayload } from "@/services/loan.service";
import type { Loan } from "@/types";
import { editedCollaterals, type PledgedCollateral, type SelectedCollateral } from "./edit-collaterals";

/**
 * An edit's `PUT /loans/{id}` body. Its `collaterals` list names each
 * collateral by id only; the server sets the value each is held at
 * (decision 11a). Declared here rather than through the shared
 * `LoanCollateralInput`, which still carries a `snapshot_value` the server now
 * ignores.
 */
export type LoanEditPayload = Omit<LoanApplicationPayload, "collaterals"> & {
  collaterals?: PledgedCollateral[];
};

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
  payload: Omit<LoanApplicationPayload, "collaterals">,
  selected: readonly SelectedCollateral[],
  attached: readonly SelectedCollateral[] | null,
): Promise<Loan> {
  const body: LoanEditPayload = { ...payload, ...editedCollaterals(selected, attached) };
  return api.put<Loan>(API_ENDPOINTS.LOANS.UPDATE(loanId), body);
}
