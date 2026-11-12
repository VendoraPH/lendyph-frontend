/**
 * Savings servicing (gap round F4b; backend S3 and S4): transfers to share
 * capital, auto-credit instructions and runs, the dormancy lists, account
 * notes and the reactivation approval. Every figure is the server's
 * two-decimal string; the browser shows it as sent and works nothing out.
 */

import type { PaginatedResponse } from "./api";
import type {
  MoneyString,
  SavingsAccount,
  SavingsAccountStatus,
  SavingsApproval,
  SavingsTransaction,
  SavingsUserRef,
} from "./savings";

// ── Savings to share capital (S3) ──

/** `POST /savings/accounts/{id}/share-capital-transfers`. The date is today. */
export interface ShareCapitalTransferInput {
  amount: string;
  remarks?: string;
}

/** 201: the savings row, the share capital credit linked to it, and the member's new balance. */
export interface ShareCapitalTransferResult {
  transaction: SavingsTransaction;
  share_capital_entry: {
    id: number;
    reference: string | null;
    date: string | null;
    credit: MoneyString;
    /** `savings_transfer`, "Transfer from savings". */
    method: string | null;
    reference_number: string | null;
  };
  /** Null without share_capital:view. */
  share_capital_balance: MoneyString | null;
}

// ── Status change (S4) ──

/**
 * `POST /savings/accounts/{id}/status`: freezing and unfreezing answer 200
 * with the account; reactivating a dormant account answers 202 with the
 * approval and the server's sentence, and the account stays dormant.
 */
export type SavingsStatusResult =
  | { kind: "changed"; account: SavingsAccount }
  | { kind: "sent_for_approval"; approval: SavingsApproval; message: string | null };

// ── Account notes (S4) ──

export interface SavingsAccountNote {
  id: number;
  note: string;
  created_by: SavingsUserRef | null;
  created_at: string | null;
}

export type SavingsAccountNotesResponse = PaginatedResponse<SavingsAccountNote>;

// ── Auto-credit (S3) ──

/** The pledges' keys: the 15th, the 30th (month end), or both. */
export type AutoCreditSchedule = "15" | "30" | "15/30";

export interface SavingsAutoCreditInstruction {
  id: number;
  account_id: number;
  account_number: string | null;
  borrower_name: string | null;
  branch_name: string | null;
  product_name: string | null;
  amount: MoneyString;
  schedule: AutoCreditSchedule;
  /** In words: "15th", "30th (month end)", "15th and 30th". */
  schedule_label: string;
  active: boolean;
  authorised_on: string | null;
  /** Free text: who authorised it (the member, a payroll officer). */
  authorised_by: string | null;
  remarks: string | null;
  /** The last cycle it credited; an instruction that has credited can't be deleted. */
  last_cycle_date: string | null;
  created_by: SavingsUserRef | null;
  updated_by: SavingsUserRef | null;
  created_at: string | null;
  updated_at: string | null;
}

export type SavingsAutoCreditInstructionsResponse = PaginatedResponse<SavingsAutoCreditInstruction>;

/** `POST /savings/auto-credit/instructions`. */
export interface SavingsAutoCreditInstructionInput {
  account_id: number;
  amount: string;
  schedule: AutoCreditSchedule;
  active?: boolean;
  authorised_on: string;
  authorised_by: string;
  remarks?: string | null;
}

/** `PUT /savings/auto-credit/instructions/{id}`: any field but the account. */
export type SavingsAutoCreditInstructionUpdate = Partial<Omit<SavingsAutoCreditInstructionInput, "account_id">>;

/** The settlement account the run's deposits come in through. */
export type SavingsAutoCreditMethod = "bank_transfer" | "cash" | "gcash" | "maya";

/** `GET /savings/auto-credit/preview` and `POST /savings/auto-credit/process`. */
export interface SavingsAutoCreditRunInput {
  /** A 15th or a month's last day, today or up to 92 days ago. */
  cycle_date: string;
  method: SavingsAutoCreditMethod;
  reference_number?: string;
}

export interface AutoCreditRunLine {
  instruction_id: number;
  account_id: number;
  account_number: string | null;
  borrower_name: string | null;
  amount: MoneyString;
}

/** A credit the run posts (preview: will post). */
export interface AutoCreditCreditLine extends AutoCreditRunLine {
  /** Null on the preview. */
  transaction_id: number | null;
  reference: string | null;
}

export interface AutoCreditSkippedLine extends AutoCreditRunLine {
  /** In words. */
  reason: string;
}

/** An account this cycle already credited; never credited again. */
export interface AutoCreditAlreadyLine extends AutoCreditRunLine {
  transaction_id: number | null;
  reference: string | null;
  status: "credited" | "reversed";
  /** "Credited" or "Credited, then reversed". */
  status_label: string;
}

export interface AutoCreditRunTotals {
  credit_count: number;
  credit_amount: MoneyString;
  skipped_count: number;
  skipped_amount: MoneyString;
  already_credited_count: number;
}

/** The plan (preview, `run_id` null) or what the run posted. */
export interface SavingsAutoCreditRunResult {
  run_id: number | null;
  cycle_date: string;
  /** Every credit posts today's date, even for an earlier cycle. */
  posting_date: string;
  method: SavingsAutoCreditMethod;
  reference_number: string | null;
  credits: AutoCreditCreditLine[];
  skipped: AutoCreditSkippedLine[];
  already_credited: AutoCreditAlreadyLine[];
  totals: AutoCreditRunTotals;
}

// ── Dormancy lists (S4, on GET /reports/savings/dormant) ──

export type DormancyList = "dormant" | "approaching";

interface DormancyRowBase {
  account_id: number;
  account_number: string;
  borrower_id: number | null;
  borrower_name: string | null;
  borrower_code: string | null;
  product_id: number | null;
  product_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  status: SavingsAccountStatus;
  balance: MoneyString;
  last_member_activity_on: string | null;
}

export interface DormantAccountRow extends DormancyRowBase {
  dormant_since: string | null;
}

export interface ApproachingDormancyRow extends DormancyRowBase {
  /** The day it turns dormant without member activity. */
  dormant_on: string;
  days_left: number;
}

/** The same for both lists. */
export interface DormancyTotals {
  account_count: number;
  total_balance: MoneyString;
  approaching_count: number;
  approaching_balance: MoneyString;
  reactivated_this_month: number;
}

export interface DormancyListResponse<Row> {
  data: Row[];
  meta: PaginatedResponse<Row>["meta"] & {
    totals?: DormancyTotals;
    as_of?: string;
    list?: DormancyList;
    /** On the approaching list. */
    dormancy_warning_days?: number;
  };
}
