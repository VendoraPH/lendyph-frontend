// How an audit row reads on the Audit Trail: its module, action, user and
// description. Dependency-free so it is unit-testable under `tsx --test`.

import type { AuditAction, AuditLog, AuditModule } from "@/types";
import { LOAN_STATUS_LABELS } from "@/constants/loan-status";
import { roleLabelForKey } from "@/lib/role-display-name";
import { permissionChipLabel } from "@/app/(app)/users/_lib/user-labels";
import { PRODUCT_FIELD_LABELS } from "@/app/(app)/settings/loan-products/_lib/product-form";
import {
  ACCOUNT_STATUS_LABELS,
  APPROVAL_STATUS_LABELS,
  HOLD_STATUS_LABELS,
  INTEREST_RUN_STATUS_LABELS,
} from "@/app/(app)/savings/_lib/savings-rules";
import { TD_STATUS_LABELS } from "@/app/(app)/savings/_lib/time-deposit-rules";

const MODULE_LABELS: Record<AuditModule, string> = {
  auth: "Auth",
  borrowers: "Members",
  loans: "Loans",
  payments: "Payments",
  collections: "Collections",
  users: "Users",
  roles: "Roles",
  accounting: "Accounting",
  gcash: "GCash",
  reminders: "Reminders",
  credit_scoring: "Credit Scoring",
  savings: "Savings",
  cda: "CDA Compliance",
  member_portal: "Member Portal",
  system: "System",
};

/**
 * The module filter's options: exactly the module names the audit log list's
 * `module` parameter accepts (anything else is refused with 422).
 */
export const AUDIT_MODULE_OPTIONS: { value: AuditModule; label: string }[] = (
  [
    "auth",
    "borrowers",
    "loans",
    "payments",
    "collections",
    "users",
    "roles",
    "accounting",
    "gcash",
    "reminders",
    "credit_scoring",
    "savings",
    "cda",
    "member_portal",
    "system",
  ] as const
).map((value) => ({ value, label: MODULE_LABELS[value] }));

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  voided: "Voided",
  approved: "Approved",
  rejected: "Rejected",
  released: "Released",
  printed: "Printed",
  reset_password: "Reset Password",
  status_changed: "Status Changed",
  role_permissions_changed: "Permissions changed",
  uploaded: "Uploaded",
  attachment_removed: "Attachment removed",
  loan_chain_cancelled: "Approvals cancelled",
  savings_account_frozen: "Account frozen",
  savings_account_unfrozen: "Account unfrozen",
  savings_account_reactivated: "Account reactivated",
  savings_account_dormant: "Account marked dormant",
  savings_account_closed: "Account closed",
  savings_hold_expired: "Hold expired",
  savings_approval_expired: "Request expired",
  time_deposit_matured: "Time deposit matured",
  time_deposit_settled: "Time deposit settled",
  time_deposit_preterminated: "Time deposit pre-terminated",
  cda_workflow: "Report workflow",
  cda_report_saved: "Report saved",
  cda_report_refreshed: "Report refreshed",
  cda_export_generated: "Report exported",
  year_end_captured: "Year-end figures captured",
  // Member Portal: staff actions, members' own actions and the system's.
  portal_code_issued: "Portal code issued",
  portal_activated: "Portal activated",
  portal_password_reset: "Portal password reset with a code",
  portal_password_changed: "Portal password changed",
  portal_signed_in: "Signed in to the portal",
  portal_signed_out: "Signed out of the portal by staff",
  portal_sessions_signed_out: "Portal sessions signed out",
  portal_access_disabled: "Portal access turned off",
  portal_access_enabled: "Portal access turned back on",
  portal_unlocked: "Portal account unlocked",
  portal_locked_out: "Portal account locked after wrong passwords",
  portal_hard_locked: "Portal account locked until staff unlock",
  portal_login_reported: "Portal sign-in reported",
  portal_terms_accepted: "Portal terms accepted",
  portal_terms_published: "Portal terms published",
  portal_statement_downloaded: "Statement downloaded in the portal",
  portal_document_downloaded: "Document downloaded in the portal",
  portal_document_shared: "Document shared with the member",
  portal_document_unshared: "Document no longer shared with the member",
  portal_request_submitted: "Portal request sent",
  portal_request_cancelled: "Portal request cancelled",
  portal_request_replied: "Member replied to a portal request",
  portal_request_decided: "Portal request decided",
  portal_request_expired: "Portal request expired",
  portal_request_hold_placed: "Money held for a portal request",
  portal_request_hold_released: "Money held for a portal request released",
  portal_announcement_created: "Announcement drafted",
  portal_announcement_updated: "Announcement edited",
  portal_announcement_published: "Announcement published",
  portal_announcement_withdrawn: "Announcement withdrawn",
  portal_announcement_deleted: "Announcement draft deleted",
};

/**
 * The Action filter's options. The audit log list's `action` parameter takes
 * any stored action; these are the ones a person filters by.
 */
export const AUDIT_ACTION_OPTIONS: { value: AuditAction; label: string }[] = (
  [
    "login",
    "logout",
    "created",
    "updated",
    "deleted",
    "voided",
    "approved",
    "rejected",
    "released",
    "printed",
    "reset_password",
    "status_changed",
    "uploaded",
    "attachment_removed",
    "loan_chain_cancelled",
    "savings_account_frozen",
    "savings_account_unfrozen",
    "savings_account_reactivated",
    "savings_account_dormant",
    "savings_account_closed",
    "savings_hold_expired",
    "savings_approval_expired",
    "time_deposit_matured",
    "time_deposit_settled",
    "time_deposit_preterminated",
    "cda_workflow",
    "cda_report_saved",
    "cda_report_refreshed",
    "cda_export_generated",
  ] as const
).map((value) => ({ value, label: ACTION_LABELS[value] }));

/** "loan_step_sent_back" → "Loan step sent back". */
function inWords(key: string): string {
  const words = key.split("_").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The row's module. `AuditLogResource` files Role rows under `roles`; older
 * responses filed them under `users`, so a Role target reads as Roles either way.
 */
export function auditModuleLabel(log: Pick<AuditLog, "module" | "target">): string {
  if (log.target?.type === "Role") return "Roles";
  return (MODULE_LABELS as Record<string, string>)[log.module] ?? inWords(log.module);
}

/**
 * Target kinds whose class name doesn't read as what it holds: the audited
 * reminders models (backend #232, module `reminders`).
 */
const TARGET_TYPE_LABELS: Record<string, string> = {
  // Accounting models, as the Accounting menu names what they hold
  // ("Journal Entries", "Chart of Accounts", "Expenses & Payables", …).
  AccountingJournal: "Journal entry",
  AccountingJournalLine: "Journal entry line",
  AccountingAccount: "Account",
  AccountingAccountMapping: "Account mapping",
  AccountingAllowancePosting: "Allowance for credit losses posting",
  AccountingExpense: "Expense",
  AccountingExpensePayment: "Expense payment",
  AccountingOpeningBalance: "Opening balance",
  AccountingYearClose: "Year-end close",
  GCashNonMember: "GCash walk-in",
  CsvImportRun: "Data import",
  SavingsAccount: "Savings account",
  SavingsHold: "Savings hold",
  SavingsApproval: "Savings approval request",
  SavingsInterestRun: "Savings interest run",
  SavingsProduct: "Savings product",
  SavingsProductRate: "Savings product rate",
  SavingsTaxRule: "Savings tax rule",
  SavingsSetting: "Savings settings",
  TimeDeposit: "Time deposit",
  ReminderSetting: "Reminder settings",
  ReminderBranchSetting: "Branch reminder settings",
  ReminderRule: "Reminder rule",
  ReminderTemplate: "Reminder template",
  ReminderPause: "Reminder pause",
  BorrowerNotificationPreference: "Member reminder preferences",
  CdaRegulatoryProfile: "CDA regulatory profile",
  CdaSetting: "CDA settings",
  CdaReportTemplate: "CDA report template",
  CdaReportingPeriod: "CDA reporting period",
  CdaReport: "CDA report",
  CdaReportValue: "CDA report figure",
  CdaReportSnapshot: "CDA report version",
  CdaSubmission: "CDA filing",
  CdaDocument: "CDA document",
  CdaDocumentVersion: "CDA document version",
  CdaOfficer: "CDA officer",
  CdaOfficerTraining: "Officer training",
  CdaSocialProgram: "Social program",
  CdaMediationCase: "Mediation case",
  CdaNoticeSent: "CDA notice",
  PortalUser: "Portal account",
  PortalCode: "Portal code",
  PortalSetting: "Member Portal settings",
  PortalTermsVersion: "Portal terms",
  PortalRequest: "Portal request",
  PortalAnnouncement: "Portal announcement",
};

/**
 * The target's kind in words. The server sends the class name ("CoMaker",
 * "LoanApprovalStep"), and a member's class is `Borrower`.
 */
export function auditTargetType(type: string): string {
  if (Object.hasOwn(TARGET_TYPE_LABELS, type)) return TARGET_TYPE_LABELS[type];
  return classInWords(type);
}

/**
 * A class name in words, the rule the server's `AuditLogResource::typeInWords`
 * also follows for a target it has nothing else to name by ("Accounting
 * journal #557").
 */
function classInWords(type: string): string {
  return type
    .replace(/^Borrower/, "Member")
    .replace(/^Cda(?=[A-Z])/, "CDA ")
    .replace(/CoMaker/g, "Co-maker")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word, i) => (i === 0 || word === "GCash" || word === "CDA" ? word : word.toLowerCase()))
    .join(" ");
}

/** Lower case with no spacing, so "Line #1" and "line # 1" compare equal. */
function compact(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

/**
 * The audit detail's line under the target's label: its type in words and its
 * id ("Journal entry #12"). Null when the label already reads the same (a
 * target with no name of its own, "Accounting reconciliation line #1"), so it
 * shows once.
 */
export function auditTargetTypeLine(target: { id: number; type: string; label: string }): string | null {
  const line = `${auditTargetType(target.type)} #${target.id}`;
  return compact(line) === compact(auditTargetLabel(target)) ? null : line;
}

/**
 * The target's heading: the server's label, except where the server had
 * nothing to name it by and fell back on its class in words ("Accounting
 * journal #557"); that reads in this screen's words instead ("Journal entry
 * #557"), so the heading and the type line never say one thing two ways.
 */
export function auditTargetLabel(target: { id: number; type: string; label: string }): string {
  const fallback = `${classInWords(target.type)} #${target.id}`;
  return compact(target.label) === compact(fallback) ? `${auditTargetType(target.type)} #${target.id}` : target.label;
}

/** The row's action: a known label, or the server's key in words. */
export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? inWords(action);
}

/**
 * Who did it. A member's own portal action reads as the server names it
 * ("Member: Juan Dela Cruz (BRW-000012)"); a row with no user (a login
 * attempt, a job) is the System.
 */
export function auditUserName(log: Pick<AuditLog, "user" | "actor_type" | "actor_label">): string {
  if (log.actor_type === "member") return log.actor_label?.trim() || "Member";
  return log.user?.full_name?.trim() || "System";
}

/** The user's role by its label (catalog, else the key in words); "Member Portal" for a member's own action. */
export function auditUserRole(log: Pick<AuditLog, "user" | "actor_type">): string {
  if (log.actor_type === "member") return "Member Portal";
  return roleLabelForKey(log.user?.roles?.[0], undefined);
}

/** Changed fields whose key doesn't read as what it holds. */
const FIELD_LABELS: Record<string, string> = {
  branch_id: "branch",
  branch_ids: "branches",
  account_officer_id: "account officer",
  applicable_product_ids: "applicable products",
  loan_product_id: "loan product",
  step_id: "step",
  source_loan_id: "source loan",
  restructured_into_loan_id: "restructured into loan",
  inherited_collateral_ids: "inherited collaterals",
  // Journal links: the server words their values as the journal's number.
  reversed_by_journal_id: "reversed by",
  matched_journal_line_id: "matched to",
  reverses_journal_id: "reverses",
  journal_id: "journal",
  accounting_journal_id: "journal",
  // Savings links (Phase 3): the transaction, run, request and placement ids
  // savings rows carry.
  result_transaction_id: "result transaction",
  reverses_transaction_id: "reversed transaction",
  counterpart_transaction_id: "counterpart transaction",
  interest_transaction_id: "interest transaction",
  tax_transaction_id: "tax transaction",
  funding_transaction_id: "funding transaction",
  target_transaction_id: "target transaction",
  interest_run_id: "interest run",
  approval_id: "approval request",
  first_checker_id: "first approver",
  time_deposit_id: "time deposit",
  payout_account_id: "payout account",
  pretermination_product_id: "early termination product",
  rolled_over_from_id: "rolled over from",
};

/**
 * Savings rows' plain ids, which mean something narrower on a savings record
 * than elsewhere (an `account_id` there is a savings account).
 */
const SAVINGS_FIELD_LABELS: Record<string, string> = {
  account_id: "savings account",
  product_id: "savings product",
  borrower_id: "member",
  run_id: "interest run",
  source_id: "source",
};

function isSavingsTarget(type: string | undefined): boolean {
  return type === "TimeDeposit" || (type?.startsWith("Savings") ?? false);
}

/**
 * A changed field's name, with every underscore as a space. A loan product's
 * fields read as the product form labels them.
 */
export function auditFieldLabel(field: string, target?: Pick<NonNullable<AuditLog["target"]>, "type"> | null): string {
  if (target?.type === "LoanProduct" && Object.hasOwn(PRODUCT_FIELD_LABELS, field)) {
    return PRODUCT_FIELD_LABELS[field];
  }
  if (isSavingsTarget(target?.type) && Object.hasOwn(SAVINGS_FIELD_LABELS, field)) return SAVINGS_FIELD_LABELS[field];
  if (Object.hasOwn(FIELD_LABELS, field)) return FIELD_LABELS[field];
  return field.split("_").filter(Boolean).join(" ");
}

function isStatusField(field: string): boolean {
  return field === "status" || field.endsWith("_status");
}

/**
 * The savings records' statuses in words, by audit target. The server keeps
 * them raw in audit rows; "preterminated" reads "Pre-terminated" here.
 */
const SAVINGS_STATUS_LABELS: Record<string, Record<string, string>> = {
  SavingsAccount: ACCOUNT_STATUS_LABELS,
  SavingsHold: HOLD_STATUS_LABELS,
  SavingsApproval: APPROVAL_STATUS_LABELS,
  TimeDeposit: TD_STATUS_LABELS,
  SavingsInterestRun: INTEREST_RUN_STATUS_LABELS,
};

/**
 * A changed value as the row shows it. A status reads in words with a capital
 * ("Draft", "Posted"): a loan's `status` reads the app's own label, and
 * `for_review` is "For Approval" on every record. The server words every other
 * kind of value itself (`AuditLogResource`), so those stay as sent.
 */
export function auditChangeValue(
  log: Pick<AuditLog, "target">,
  field: string,
  value: string | null,
): string | null {
  if (value === null) return value;
  if (field === "permissions") return permissionsInWords(value);
  if (!isStatusField(field)) return value;
  const savingsStatuses = log.target ? SAVINGS_STATUS_LABELS[log.target.type] : undefined;
  if (field === "status" && savingsStatuses && Object.hasOwn(savingsStatuses, value)) return savingsStatuses[value];
  const isLoanStatus = field === "status" && log.target?.type === "Loan";
  if ((isLoanStatus || value === "for_review") && Object.hasOwn(LOAN_STATUS_LABELS, value)) {
    return LOAN_STATUS_LABELS[value as keyof typeof LOAN_STATUS_LABELS];
  }
  return inWords(value);
}

const PERMISSION_KEY = /^[a-z_]+:[a-z_]+$/;

/** "auto_pay:view, borrowers:view" → "Auto-Pay: View, Members: View". Anything else stays as sent. */
function permissionsInWords(value: string): string {
  return value
    .split(", ")
    .map((part) => (PERMISSION_KEY.test(part) ? permissionChipLabel(part) : part))
    .join(", ");
}

/**
 * A change's old and new values as the row shows them. When two different
 * stored statuses read the same ("released" and "ongoing" both read
 * "Current"), each side reads its stored status in words instead.
 */
export function auditChangePair(
  log: Pick<AuditLog, "target">,
  change: { field: string; old: string | null; new: string | null },
): { old: string | null; new: string | null } {
  const old = auditChangeValue(log, change.field, change.old);
  const next = auditChangeValue(log, change.field, change.new);
  if (old !== null && old === next && change.old !== change.new && isStatusField(change.field)) {
    return { old: inWords(change.old as string), new: inWords(change.new as string) };
  }
  return { old, new: next };
}

/** Bookkeeping fields a deleted row's summary leaves out: the id and timestamps. */
function isBookkeepingField(field: string): boolean {
  return field === "id" || field.endsWith("_at");
}

/** "Created" or "Deleted", with the record's label when the server sent one. */
function withRecordLabel(verb: string, target: AuditLog["target"]): string {
  const label = target?.label?.trim();
  return label ? `${verb}: ${label}` : verb;
}

/**
 * The row's description. When the server wrote none: a created row reads
 * "Created: <record>", a deleted row lists the old values of its meaningful
 * fields, and any other row lists the fields it changed as old → new.
 */
export function auditDescription(
  log: Pick<AuditLog, "description" | "changes" | "action" | "target">
): string {
  const own = log.description?.trim();
  if (own) return own;
  const changes = log.changes ?? [];

  if (log.action === "created") return withRecordLabel("Created", log.target);

  if (log.action === "deleted") {
    const kept = changes.filter((c) => !isBookkeepingField(c.field) && c.old !== null && c.old !== "");
    if (kept.length === 0) return withRecordLabel("Deleted", log.target);
    return `Deleted: ${kept.map((c) => `${auditFieldLabel(c.field, log.target)} ${auditChangeValue(log, c.field, c.old)}`).join(", ")}`;
  }

  if (changes.length === 0) return "";
  const parts = changes.map((c) => {
    const pair = auditChangePair(log, c);
    return `${auditFieldLabel(c.field, log.target)}: ${pair.old ?? "—"} → ${pair.new ?? "—"}`;
  });
  return `Changed ${parts.join("; ")}`;
}
