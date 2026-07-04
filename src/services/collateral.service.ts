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

const ACTIVE_LOAN_STATUSES = new Set([
  "released",
  "current",
  "ongoing",
  "past_due",
]);

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

  listForLoan: async (loanId: number): Promise<LoanCollateral[]> => {
    const res = await api.get<
      PaginatedResponse<LoanCollateral> | LoanCollateral[]
    >(API_ENDPOINTS.COLLATERALS.LIST_FOR_LOAN(loanId));
    return unwrapList<LoanCollateral>(res);
  },

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

  /**
   * For each collateral, returns the active-loan info if any. Fetches
   * attachments per active loan in parallel — no global "list all loan
   * collaterals" endpoint exists.
   */
  buildActiveLoanIndex: async (
    loans: { id: number; status: string; loan_account_number?: string }[],
  ): Promise<Map<number, { loan_id: number; loan_account_number?: string }>> => {
    const activeLoans = loans.filter((l) => ACTIVE_LOAN_STATUSES.has(l.status));
    const index = new Map<
      number,
      { loan_id: number; loan_account_number?: string }
    >();
    if (activeLoans.length === 0) return index;
    const linksPerLoan = await Promise.all(
      activeLoans.map((l) => collateralService.listForLoan(l.id)),
    );
    activeLoans.forEach((loan, i) => {
      for (const link of linksPerLoan[i]) {
        index.set(link.collateral_id, {
          loan_id: loan.id,
          loan_account_number: loan.loan_account_number,
        });
      }
    });
    return index;
  },
};
