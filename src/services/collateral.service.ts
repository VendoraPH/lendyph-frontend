/**
 * Collateral service.
 *
 * Mock-backed via `collateral-storage.ts`. Replace bodies with `api.*`
 * calls against `API_ENDPOINTS.COLLATERALS.*` when backend ships.
 */

import type { Collateral, LoanCollateral } from "@/types";
import {
  collateralStorage,
  loanCollateralStorage,
} from "@/lib/collateral-storage";

export interface CreateCollateralData {
  borrower_id: number;
  collateral_type_id: number;
  detail_value: string;
  amount: number;
}

export type UpdateCollateralData = Partial<CreateCollateralData>;

export const collateralService = {
  list: (params?: { borrower_id?: number }): Promise<Collateral[]> =>
    collateralStorage.list(params),

  detail: (id: number): Promise<Collateral | null> =>
    collateralStorage.detail(id),

  create: (data: CreateCollateralData): Promise<Collateral> =>
    collateralStorage.create(data),

  update: (id: number, data: UpdateCollateralData): Promise<Collateral> =>
    collateralStorage.update(id, data),

  delete: (id: number): Promise<void> => collateralStorage.remove(id),

  // ── Loan attachments ──

  listForLoan: (loanId: number): Promise<LoanCollateral[]> =>
    loanCollateralStorage.listForLoan(loanId),

  listForCollateral: (collateralId: number): Promise<LoanCollateral[]> =>
    loanCollateralStorage.listForCollateral(collateralId),

  attachToLoan: (
    loanId: number,
    collateralId: number,
    snapshotValue: number,
  ): Promise<LoanCollateral> =>
    loanCollateralStorage.attach(loanId, collateralId, snapshotValue),

  detachFromLoan: (loanId: number, collateralId: number): Promise<void> =>
    loanCollateralStorage.detach(loanId, collateralId),
};
