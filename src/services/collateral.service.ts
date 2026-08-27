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

/**
 * Stale, and a symptom rather than the disease.
 *
 * The server's set is `Loan::ACTIVE_STATUSES` = `released, ongoing`. `current`
 * and `past_due` are not members of the `loans.status` enum at all — they were
 * retired, and no row has carried either since. They match nothing here, which
 * is harmless only by luck.
 *
 * Do not repair this by editing the list. The server accepts `status=active` as
 * a virtual value that expands from `Loan::ACTIVE_STATUSES`, precisely so the
 * definition lives in one place; a list pinned in a client goes stale silently,
 * as this one did. The fix is to stop deciding "active" on the client at all —
 * see buildActiveLoanIndex() below.
 */
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
   * For each collateral, the active loan holding it, if any.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * KNOWN BROKEN. Do not page the caller's `loanService.list()` to fix it.
   * ─────────────────────────────────────────────────────────────────────────
   *
   * What "locked" means: a row in `loan_collaterals` joining the collateral to a
   * loan whose status is in `Loan::ACTIVE_STATUSES`. That is a single join on
   * the server. There is no endpoint that answers it.
   *
   * The only pivot read the API offers is `GET /loans/{id}/collaterals` — one
   * loan at a time. `GET /collaterals` returns every collateral (unpaginated,
   * so that half is complete) but `CollateralResource` exposes no loan linkage:
   * its `pivot` key only materialises on the loan-scoped route. `LoanResource`
   * carries no collaterals either. So a client can only answer "is this pledged"
   * by enumerating every active loan and asking each one what it holds.
   *
   * Which is what this does, and why every caller is wrong today: they pass
   * `loanService.list()` with no params, so the "every active loan" input is
   * really the newest 15 loans of ANY status — mostly drafts. A collateral
   * pledged to an older active loan is absent from the index and the UI offers
   * it as available. On a lending co-op that is a double pledge.
   *
   * The tempting fix — page the loan list with `status=active` — makes it worse.
   * The 15-row ceiling is the only thing bounding the fan-out below. Feed this a
   * complete active-loan set and it issues one HTTP request per active loan, on
   * a screen that is the collateral landing page, through a browser that will
   * run six of them at a time. Correctness would be bought with an O(N) request
   * storm to compute something the database answers in one join.
   *
   * The fix belongs on the server. The smallest version: eager-load the active
   * loans onto `GET /collaterals` and expose them on `CollateralResource` —
   *
   *     active_loans: [{ id, loan_account_number }]   // [] when unpledged
   *
   * — filtered by `Loan::ACTIVE_STATUSES` so the definition stays in the one
   * place that already owns it. Every screen then reads the field off the row it
   * already has, this function is deleted along with ACTIVE_LOAN_STATUSES above,
   * and the collaterals page drops from `1 + ceil(N/100) + N` requests to 1.
   *
   * An array rather than a scalar `active_loan_id` because `loan_collaterals` is
   * unique on `(loan_id, collateral_id)` — nothing stops one collateral sitting
   * on two active loans, and on a screen whose whole job is spotting double
   * pledges, "pledged to 2 loans" is the answer you most need to see.
   *
   * Related and worse: `CollateralController::attach()` only rejects re-attaching
   * to the SAME loan (`AttachCollateralRequest` validates
   * `exists:collaterals,id` and nothing else). Nothing server-side refuses a
   * collateral already pledged to another active loan, and nothing requires the
   * collateral to belong to the loan's borrower. The lock this index draws is
   * advisory UI, not an enforced constraint — so the real double-pledge guard
   * has to be a check in `attach()`, not a badge here.
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
