export type AuditAction =
  | "login"
  | "logout"
  | "created"
  | "updated"
  | "deleted"
  | "voided"
  | "approved"
  | "rejected"
  | "released"
  | "printed"
  | "reset_password"
  | "status_changed"
  // A member document or an accounting attachment added, and an attachment
  // taken off a journal or expense.
  | "uploaded"
  | "attachment_removed"
  // A voided loan's pending approval steps, cancelled with it.
  | "loan_chain_cancelled"
  // Savings & Deposits.
  | "savings_account_frozen"
  | "savings_account_unfrozen"
  | "savings_account_reactivated"
  | "savings_account_dormant"
  | "savings_account_closed"
  | "savings_hold_expired"
  | "savings_approval_expired"
  | "time_deposit_matured"
  | "time_deposit_settled"
  | "time_deposit_preterminated"
  // CDA Compliance: a report's workflow step, a save, a refresh that changed
  // figures, a server export, and the year-end capture.
  | "cda_workflow"
  | "cda_report_saved"
  | "cda_report_refreshed"
  | "cda_export_generated"
  | "year_end_captured";

export type AuditModule =
  | "auth"
  | "borrowers"
  | "loans"
  | "payments"
  | "collections"
  | "users"
  | "roles"
  | "accounting"
  | "gcash"
  // Reminders (Phase 2): settings, branch settings, rules, templates, pauses
  // and members' notification preferences.
  | "reminders"
  // Credit Scoring (Phase 2): settings, scorecard revisions, application
  // details and credit decisions.
  | "credit_scoring"
  // Savings & Deposits (Phase 3): accounts, holds, approvals, time deposits,
  // interest runs, products, rates, tax rules and settings.
  | "savings"
  // CDA Compliance (Phase 3): reports, periods, templates, settings, the
  // registers and the document repository.
  | "cda"
  // Member Portal (Phase 3): portal accounts, codes, settings, terms,
  // requests and announcements, and members' own portal actions.
  | "member_portal"
  | "system";

export interface AuditChange {
  field: string;
  old: string | null;
  new: string | null;
}

export interface AuditLog {
  id: number;
  user: {
    id: number;
    full_name: string;
    roles: string[];
  };
  /**
   * Who wrote the row: `staff` (`user`), `member` (a member's own portal
   * action: `user` is null and `actor_label` names them) or `system`.
   */
  actor_type?: "staff" | "member" | "system";
  /** "Member: <name> (<number>)" on a member's row, else null. */
  actor_label?: string | null;
  action: AuditAction;
  module: AuditModule;
  description: string;
  target: {
    id: number;
    type: string;
    label: string;
  } | null;
  changes: AuditChange[];
  ip_address: string;
  created_at: string;
}
