// How an audit row reads on the Audit Trail: its module, action, user and
// description. Dependency-free so it is unit-testable under `tsx --test`.

import type { AuditLog, AuditModule } from "@/types";
import { LOAN_STATUS_LABELS } from "@/constants/loan-status";
import { roleLabelForKey } from "@/lib/role-display-name";

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
};

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
 * The target's kind in words. The server sends the class name ("CoMaker",
 * "LoanApprovalStep"), and a member's class is `Borrower`.
 */
export function auditTargetType(type: string): string {
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

/** A changed field's name with every underscore as a space. */
export function auditFieldLabel(field: string): string {
  return field.split("_").filter(Boolean).join(" ");
}

/**
 * A changed value as the row shows it. A loan's `status` reads the app's own
 * label (`for_review` reads "For Approval"); any other value, including a status
 * the app has no label for, stays as the server stored it.
 */
export function auditChangeValue(
  log: Pick<AuditLog, "target">,
  field: string,
  value: string | null,
): string | null {
  if (value === null || field !== "status" || log.target?.type !== "Loan") return value;
  return Object.hasOwn(LOAN_STATUS_LABELS, value)
    ? LOAN_STATUS_LABELS[value as keyof typeof LOAN_STATUS_LABELS]
    : value;
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
    return `Deleted: ${kept.map((c) => `${auditFieldLabel(c.field)} ${auditChangeValue(log, c.field, c.old)}`).join(", ")}`;
  }

  if (changes.length === 0) return "";
  const parts = changes.map(
    (c) =>
      `${auditFieldLabel(c.field)}: ${auditChangeValue(log, c.field, c.old) ?? "—"} → ${auditChangeValue(log, c.field, c.new) ?? "—"}`
  );
  return `Changed ${parts.join("; ")}`;
}
