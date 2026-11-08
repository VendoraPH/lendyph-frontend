export type CivilStatus = "single" | "married" | "widowed" | "separated" | "divorced";
export type Gender = "male" | "female";
export type BorrowerStatus = "active" | "inactive" | "blacklisted";
export type ValidIdType =
  | "philippine_id"
  | "drivers_license"
  | "passport"
  | "sss"
  | "umid"
  | "voters_id"
  | "postal_id"
  | "prc_id"
  | "tin_id";
export type EmploymentType = "employed" | "self_employed" | "ofw" | "unemployed" | "retired";

export interface BorrowerBranch {
  id: number;
  name: string;
  code: string;
}

/**
 * GET /borrowers/{id}/loan-summary: the member's loan totals, all from the
 * server. `total_borrowed` counts released loans only and leaves out
 * restructured ones (their successor carries the rolled-over balance).
 * Over released, ongoing and defaulted loans:
 * - `total_outstanding` is everything owed: principal, interest, penalty and
 *   the insurance premium owed (it used to be principal + premium only);
 * - `outstanding_principal` is the principal alone;
 * - `overdue_amount` is only what is past due, not a late loan's whole balance.
 * `total_paid` is everything the member paid, premium included, and
 * `insurance_paid` is the premium part of it. `current_loans` is released plus
 * ongoing; `counts` has every status. The newer figures are optional so an
 * older server shows a dash rather than a wrong number.
 */
export interface BorrowerLoanSummary {
  total_borrowed: number;
  total_outstanding: number;
  outstanding_principal?: number;
  overdue_amount?: number;
  total_paid: number;
  insurance_paid?: number;
  current_loans: number;
  counts: Record<string, number>;
}

/** One row of GET /borrowers/{id}/ledger (`BorrowerController::ledger()`). */
export interface BorrowerLedgerEntry {
  id: number;
  date: string;
  description: string;
  /** The loan account number on a release, the receipt number on a payment. */
  reference: string | null;
  /** What this row raised the balance by; 0 when it lowered it. */
  debit: number;
  /** What this row lowered the balance by; 0 when it raised it. */
  credit: number;
  /** The member's running balance after this row, from the server. */
  balance?: number | null;
  loan_id?: number | null;
  loan_account_number?: string | null;
  kind?: string | null;
  repayment_id?: number | null;
  /** Payment rows: what the member handed over, which can exceed the credit. */
  amount_paid?: number | string | null;
  /** Payment rows: the part that went to the insurance premium owed. */
  insurance?: number | null;
  /** Payment rows: the part credited to the Share Capital Build-Up. */
  scb?: number | null;
}

/** `meta.closing` of GET /borrowers/{id}/ledger. */
export interface BorrowerLedgerClosing {
  principal: number;
  interest: number;
  penalty: number;
  balance: number;
}

/** The whole GET /borrowers/{id}/ledger answer. */
export interface BorrowerLedgerResponse {
  data: BorrowerLedgerEntry[];
  meta?: { closing?: BorrowerLedgerClosing | null };
}

export interface Borrower {
  id: number;
  borrower_code: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  suffix?: string | null;
  full_name: string;
  birthdate?: string | null;
  civil_status?: CivilStatus | null;
  gender?: Gender | null;
  address?: string | null;
  contact_number?: string | null;
  email?: string | null;
  employer_or_business?: string | null;
  monthly_income?: number | string | null;
  photo_url?: string | null;
  // The shared `/borrowers` list also returns applicants who are not members:
  // "pending" (awaiting review) and "rejected" (soft-rejected — reject used to
  // hard-delete, so these rows only started existing with the approve/reject
  // release). Neither is loan-eligible: any picker feeding a loan, collateral
  // or GCash action must request `members_only=1` rather than filter locally.
  // BorrowerStatus itself stays narrow so the members status tabs, which can
  // only ever show the three member states, don't have to grow.
  status: BorrowerStatus | "pending" | "rejected";
  branch?: BorrowerBranch | null;
  // The list endpoint may return only the FK without the nested relation;
  // keep it so the table can resolve the branch name from the branches list.
  branch_id?: number | null;
  // Legacy fields (kept for compatibility with existing components)
  phone?: string;
  photo?: string;
  total_loans?: number;
  total_outstanding?: number;
  created_at: string;
  updated_at: string;
}
