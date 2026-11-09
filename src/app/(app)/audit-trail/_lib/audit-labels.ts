// How an audit row reads on the Audit Trail: its module, action, user and
// description. Dependency-free so it is unit-testable under `tsx --test`.

import type { AuditAction, AuditLog, AuditModule } from "@/types";
import { LOAN_STATUS_LABELS } from "@/constants/loan-status";
import { roleLabelForKey } from "@/lib/role-display-name";
import { permissionChipLabel } from "@/app/(app)/users/_lib/user-labels";
import { PRODUCT_FIELD_LABELS } from "@/app/(app)/settings/loan-products/_lib/product-form";

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
  system: "System",
};

/**
 * The module filter's options: exactly the module names the audit log list's
 * `module` parameter accepts (anything else is refused with 422).
 */
export const AUDIT_MODULE_OPTIONS: { value: AuditModule; label: string }[] = (
  ["auth", "borrowers", "loans", "payments", "collections", "users", "roles", "accounting", "gcash", "system"] as const
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
  ReminderSetting: "Reminder settings",
  ReminderBranchSetting: "Branch reminder settings",
  ReminderRule: "Reminder rule",
  ReminderTemplate: "Reminder template",
  ReminderPause: "Reminder pause",
  BorrowerNotificationPreference: "Member reminder preferences",
};

/**
 * The target's kind in words. The server sends the class name ("CoMaker",
 * "LoanApprovalStep"), and a member's class is `Borrower`.
 */
export function auditTargetType(type: string): string {
  if (Object.hasOwn(TARGET_TYPE_LABELS, type)) return TARGET_TYPE_LABELS[type];
  return type
    .replace(/^Borrower/, "Member")
    .replace(/CoMaker/g, "Co-maker")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word, i) => (i === 0 || word === "GCash" ? word : word.toLowerCase()))
    .join(" ");
}

/** The row's action: a known label, or the server's key in words. */
export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? inWords(action);
}

/** Who did it. A row with no user (a login attempt, a job) is the System. */
export function auditUserName(log: Pick<AuditLog, "user">): string {
  return log.user?.full_name?.trim() || "System";
}

/** The user's role by its label (catalog, else the key in words). */
export function auditUserRole(log: Pick<AuditLog, "user">): string {
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
};

/**
 * A changed field's name, with every underscore as a space. A loan product's
 * fields read as the product form labels them.
 */
export function auditFieldLabel(field: string, target?: Pick<NonNullable<AuditLog["target"]>, "type"> | null): string {
  if (target?.type === "LoanProduct" && Object.hasOwn(PRODUCT_FIELD_LABELS, field)) {
    return PRODUCT_FIELD_LABELS[field];
  }
  if (Object.hasOwn(FIELD_LABELS, field)) return FIELD_LABELS[field];
  return field.split("_").filter(Boolean).join(" ");
}

function isStatusField(field: string): boolean {
  return field === "status" || field.endsWith("_status");
}

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
