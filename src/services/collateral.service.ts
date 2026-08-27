import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  Collateral,
  LoanCollateral,
  PaginatedResponse,
} from "@/types";

export interface CreateCollateralData {
  borrower_id: number;
  collateral_type_id: number;
  detail_value: string;
  amount: number;
}

export type UpdateCollateralData = Partial<CreateCollateralData>;

export interface CollateralListParams {
  borrower_id?: number;
  /** Backend filters by collateral_type_id under the `type` query key. */
  type?: number;
}

function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && Array.isArray((res as { data?: T[] }).data)) {
    return (res as { data: T[] }).data;
  }
  return [];
}

export const collateralService = {
  list: async (params?: CollateralListParams): Promise<Collateral[]> => {
    const res = await api.get<PaginatedResponse<Collateral> | Collateral[]>(
      API_ENDPOINTS.COLLATERALS.LIST,
      { params },
    );
    return unwrapList<Collateral>(res);
  },

  detail: (id: number): Promise<Collateral> =>
    api.get<Collateral>(API_ENDPOINTS.COLLATERALS.DETAIL(id)),

  create: (data: CreateCollateralData): Promise<Collateral> =>
    api.post<Collateral>(API_ENDPOINTS.COLLATERALS.CREATE, data),

  update: (id: number, data: UpdateCollateralData): Promise<Collateral> =>
    api.put<Collateral>(API_ENDPOINTS.COLLATERALS.UPDATE(id), data),

  delete: (id: number): Promise<void> =>
    api.delete(API_ENDPOINTS.COLLATERALS.DELETE(id)),

  // ── Loan attachments ──

  /**
   * The collaterals attached to a loan.
   *
   * Rows are full `CollateralResource` objects — the collateral itself, with
   * the `loan_collaterals` row under `pivot` and `active_loans` alongside. They
   * are NOT pivot rows, whatever the name suggests: there is no `collateral_id`
   * key at any level, and reading one yields `undefined` rather than an error.
   * Use `row.id` for the collateral and `row.pivot?.snapshot_value` for the
   * amount it was booked at.
   *
   * `active_loans` here INCLUDES `loanId` itself when that loan is active, so
   * anything asking "is this held elsewhere" must pass
   * `{ exceptLoanId: loanId }` to `collateralLock()`.
   */
  listForLoan: async (loanId: number): Promise<LoanCollateral[]> => {
    const res = await api.get<
      PaginatedResponse<LoanCollateral> | LoanCollateral[]
    >(API_ENDPOINTS.COLLATERALS.LIST_FOR_LOAN(loanId));
    return unwrapList<LoanCollateral>(res);
  },

  /**
   * Attach a collateral to a loan.
   *
   * `CollateralController::attach()` now refuses a collateral that another loan
   * in `Loan::ACTIVE_STATUSES` already holds, with a 422 on `collateral_id`
   * naming the conflicting loan(s). The pickers filter locked rows out, so a
   * user should never reach that — but the check is the server's, not the UI's,
   * and a stale page can still hit it. Surface the message rather than a
   * generic failure: it tells the operator exactly which loan to detach from.
   */
  attachToLoan: (
    loanId: number,
    collateralId: number,
    snapshotValue: number,
  ): Promise<LoanCollateral> =>
    api.post<LoanCollateral>(API_ENDPOINTS.COLLATERALS.ATTACH(loanId), {
      collateral_id: collateralId,
      snapshot_value: snapshotValue,
    }),

  detachFromLoan: (loanId: number, collateralId: number): Promise<void> =>
    api.delete(API_ENDPOINTS.COLLATERALS.DETACH(loanId, collateralId)),
};
