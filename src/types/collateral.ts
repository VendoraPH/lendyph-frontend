/**
 * Collateral domain types.
 *
 * The feature is currently mock-backed (localStorage) — see
 * `src/lib/collateral-storage.ts`. The interfaces below mirror the REST
 * shape the backend will eventually ship, so swapping the storage layer
 * for real `api.*` calls won't require type changes.
 */

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

export interface Collateral {
  id: number;
  borrower_id: number;
  collateral_type_id: number;
  detail_value: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface LoanCollateral {
  loan_id: number;
  collateral_id: number;
  snapshot_value: number;
  attached_at: string;
}

export interface CollateralWithMeta extends Collateral {
  type?: CollateralType;
  borrower_name?: string;
  /** Set client-side from the loans list for the "tagged to active loan" badge. */
  active_loan_id?: number;
  active_loan_account_number?: string;
  /** Live value used in pickers — for share_capital source this is the borrower's current balance. */
  effective_value: number;
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
