/**
 * Collateral domain types — the shapes `CollateralController` actually returns.
 *
 * These were written against a localStorage mock and kept its shape after the
 * feature moved onto the API, which is how `LoanCollateral` came to describe a
 * pivot row the endpoint has never sent. See its note below.
 */

import type { CollateralLock } from "@/lib/collateral-lock";

export type CollateralSource = "manual" | "share_capital";

export type SecurityStatus = "secured" | "partially_secured" | "unsecured";

export interface CollateralType {
  id: number;
  name: string;
  detail_field_label: string;
  amount_field_label: string;
  source: CollateralSource;
  display_order: number;
  is_visible: boolean;
  is_seed: boolean;
  created_at: string;
  updated_at: string;
}

/** One active loan holding a collateral, as `active_loans` reports it. */
export interface ActiveLoanRef {
  id: number;
  loan_account_number: string | null;
}

export interface Collateral {
  id: number;
  borrower_id: number;
  collateral_type_id: number;
  detail_value: string;
  amount: number;
  /**
   * Every loan in `Loan::ACTIVE_STATUSES` currently holding this collateral.
   * `[]` means free. The server's answer to "is this already pledged?", so no
   * screen has to derive it from a loan list any more.
   *
   * OPTIONAL, and the optionality is load-bearing. `CollateralResource` renders
   * it with `whenLoaded`, so a caller that returns the resource without the
   * relation omits the key rather than sending `[]`. Absent therefore means
   * "nobody asked", NOT "free" — treat it as unknown and never as safe. Use
   * `collateralLock()` in `@/lib/collateral-lock` rather than testing this
   * directly; that distinction is the whole reason it exists.
   *
   * An array because `loan_collaterals` is unique on `(loan_id, collateral_id)`
   * — two active holders is a real state the UI has to be able to say out loud.
   */
  active_loans?: ActiveLoanRef[];
  created_at: string;
  updated_at: string;
}

/**
 * A row of `GET /loans/{id}/collaterals`.
 *
 * It is a full `CollateralResource` — the collateral itself — with the pivot
 * attached under `pivot`. It is NOT a `loan_collaterals` row.
 *
 * This type used to claim `{ loan_id, collateral_id, snapshot_value,
 * attached_at }` at the top level, which the endpoint has never sent. Nothing
 * caught it: the service asserts this shape onto the response rather than
 * checking it, so `link.collateral_id` was `undefined` at runtime while
 * type-checking clean. Every consumer keyed off it silently did nothing —
 * the lock index locked nothing, edit mode prefilled no collaterals, and the
 * loan detail card looked up `/collaterals/undefined`.
 *
 * `pivot` is optional for the same reason `active_loans` is: `whenPivotLoaded`
 * omits it rather than faking it.
 */
export interface LoanCollateral extends Collateral {
  type?: CollateralType;
  collateral_type?: CollateralType;
  pivot?: {
    loan_id: number;
    snapshot_value: number;
    attached_at: string | null;
  };
}

export interface CollateralWithMeta extends Collateral {
  type?: CollateralType;
  borrower_name?: string;
  /**
   * Lock state as this screen means it — usually "held by a loan OTHER than the
   * one on screen". Derived once per row with `collateralLock()` so the badge,
   * the disabled state and the counts cannot disagree with each other.
   *
   * Replaces `active_loan_id` / `active_loan_account_number`, which could only
   * name one holder and were populated from a client-side index that never
   * worked.
   */
  lock: CollateralLock;
  /** Live value used in pickers — for share_capital source this is the borrower's current balance. */
  effective_value: number;
}

// ── Collateral register (`GET /collaterals/register`) ──

/**
 * A collateral as the register sends it: valued on the server, with its type
 * and its active holders loaded.
 *
 * `value_unknown` is true only for a share-capital collateral whose balance the
 * caller may not see; `effective_value` is then 0 and must not be displayed.
 */
export interface RegisterCollateral extends Collateral {
  effective_value: number;
  value_unknown: boolean;
  collateral_type?: CollateralType;
}

/**
 * One member's collaterals, and the figures over them. Every figure is over the
 * rows that matched the request's `search` / `collateral_type_id`, not over the
 * member's whole book.
 */
export interface CollateralRegisterGroup {
  borrower_id: number;
  /** The member's full name, or `Member #{id}` when `meta.names_hidden`. */
  borrower_name: string;
  collaterals_count: number;
  /** Rows held by at least one active loan. */
  tagged_count: number;
  /** Sum of `effective_value` over the rows whose value is known. */
  total_value: number;
  /** Rows left out of `total_value` because their value is withheld. */
  unknown_count: number;
  /** Newest first. */
  collaterals: RegisterCollateral[];
}

export type CollateralRegisterSort = "member" | "collaterals" | "total_value" | "tagged";

export type CollateralRegisterDirection = "asc" | "desc";

export interface CollateralRegisterParams {
  search?: string;
  collateral_type_id?: number;
  sort?: CollateralRegisterSort;
  direction?: CollateralRegisterDirection;
  page?: number;
  per_page?: number;
}

export interface CollateralRegisterTotals {
  /** The whole book — ignores `search` and `collateral_type_id`. */
  total_collaterals: number;
  /** The whole book — ignores `search` and `collateral_type_id`. */
  tagged_to_active_loans: number;
  /** The filtered rows whose value is known. */
  total_value: number;
  /** The filtered rows whose value is withheld. */
  unknown_count: number;
  /** The filtered groups; equals `meta.total`. */
  members: number;
}

/**
 * The whole body, read with `api.getRaw`: `meta` carries the paging, the KPI
 * totals and `names_hidden`, and `api.get` would discard all three.
 */
export interface CollateralRegisterResponse {
  data: CollateralRegisterGroup[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    /** Groups (members), not collaterals. */
    total: number;
    /** True when the caller lacks `borrowers:view`, so every name is `Member #{id}`. */
    names_hidden: boolean;
    totals: CollateralRegisterTotals;
  };
}

export function computeSecurityStatus(
  loanPrincipal: number,
  totalCollateralValue: number,
): SecurityStatus {
  if (totalCollateralValue <= 0) return "unsecured";
  if (totalCollateralValue >= loanPrincipal) return "secured";
  return "partially_secured";
}

export function securityStatusLabel(status: SecurityStatus): string {
  switch (status) {
    case "secured":
      return "Secured";
    case "partially_secured":
      return "Partially Secured";
    case "unsecured":
      return "Unsecured";
  }
}
