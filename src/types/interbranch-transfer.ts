/**
 * Interbranch transfers (Phase 6 MB-BE5): money moved from one branch's money
 * account to another's through 1190 Interbranch Clearing. Every amount is
 * integer centavos, as on every accounting screen.
 */

import type { PaginatedResponse } from "./api";

export type InterbranchTransferStatus =
  | "pending_approval"
  | "in_transit"
  | "received"
  | "rejected"
  | "cancelled"
  | "reversed";

export interface InterbranchTransferBranch {
  id: number;
  name: string;
  code: string | null;
}

export interface InterbranchTransferAccount {
  id: number;
  code: string;
  name: string;
}

export interface InterbranchTransferPerson {
  id: number;
  full_name: string;
}

export interface InterbranchTransferJournal {
  id: number;
  journal_no: string | null;
}

/** What the caller may do next, by the rules the server enforces. */
export interface InterbranchTransferActions {
  can_approve: boolean;
  can_reject: boolean;
  can_cancel: boolean;
  can_receive: boolean;
  can_reverse: boolean;
}

export interface InterbranchTransfer {
  id: number;
  transfer_number: string;
  status: InterbranchTransferStatus;
  status_label: string;
  source_branch: InterbranchTransferBranch | null;
  destination_branch: InterbranchTransferBranch | null;
  from_account: InterbranchTransferAccount | null;
  to_account: InterbranchTransferAccount | null;
  clearing_account: InterbranchTransferAccount | null;
  /** Centavos. */
  amount: number;
  purpose: string;
  reference: string | null;
  /** Whole days in transit; null unless in transit. */
  age_days: number | null;
  created_by: InterbranchTransferPerson | null;
  created_at: string | null;
  approved_by: InterbranchTransferPerson | null;
  approved_at: string | null;
  received_by: InterbranchTransferPerson | null;
  received_at: string | null;
  rejected_by: InterbranchTransferPerson | null;
  rejected_at: string | null;
  rejection_note: string | null;
  cancelled_at: string | null;
  reversed_by: InterbranchTransferPerson | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  dispatch_journal: InterbranchTransferJournal | null;
  receipt_journal: InterbranchTransferJournal | null;
  dispatch_reversal_journal: InterbranchTransferJournal | null;
  actions: InterbranchTransferActions;
}

export type InterbranchTransferPage = PaginatedResponse<InterbranchTransfer>;

/** `POST /interbranch-transfers`. */
export interface InterbranchTransferInput {
  source_branch_id: number;
  destination_branch_id: number;
  from_account_id: number;
  to_account_id: number;
  /** Centavos. */
  amount: number;
  purpose: string;
  reference?: string;
}

/** A write's answer: the transfer, and warnings in words (a source going below ₱0.00). */
export interface InterbranchTransferResult {
  transfer: InterbranchTransfer;
  warnings: string[];
}

/** `GET /interbranch-transfers/in-transit`. */
export interface InterbranchInTransitReport {
  as_of: string;
  clearing_accounts: InterbranchTransferAccount[];
  /** Oldest first. */
  transfers: InterbranchTransfer[];
  branches: {
    /** Null for the "No branch" row (view_all only). */
    branch_id: number | null;
    branch_name: string;
    /** Centavos: what the branch sent less what it received. */
    net_interbranch_position: number;
  }[];
  total_clearing_balance: number;
  total_in_transit: number;
  /** Clearing total less in-transit total; null for a branch user, who sees only part of each pair. */
  difference: number | null;
}

/** `GET /branch-counts`; each figure is null without its source's permission. */
export interface BranchCounts {
  pending_transfers: number | null;
  in_transit_transfers: number | null;
  suspended_branches: number | null;
  unreconciled_branches: number | null;
}
