// How an audit row reads on the Audit Trail: its module, action, user and
// description. Dependency-free so it is unit-testable under `tsx --test`.

import type { AuditLog, AuditModule } from "@/types";
import { roleLabelForKey } from "@/lib/role-display-name";

const MODULE_LABELS: Record<AuditModule, string> = {
  auth: "Auth",
  borrowers: "Borrowers",
  loans: "Loans",
  payments: "Payments",
  collections: "Collections",
  users: "Users",
  roles: "Roles",
  system: "System",
};

/**
 * The module filter's options: exactly the module names the audit log list's
 * `module` parameter accepts (anything else is refused with 422).
 */
export const AUDIT_MODULE_OPTIONS: { value: AuditModule; label: string }[] = (
  ["auth", "borrowers", "loans", "payments", "collections", "users", "roles", "system"] as const
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
 * The row's description, or, when the server wrote none, the fields it changed
 * as old → new from its old and new values.
 */
export function auditDescription(log: Pick<AuditLog, "description" | "changes">): string {
  const own = log.description?.trim();
  if (own) return own;
  const changes = log.changes ?? [];
  if (changes.length === 0) return "";
  const parts = changes.map(
    (c) => `${auditFieldLabel(c.field)}: ${c.old ?? "—"} → ${c.new ?? "—"}`
  );
  return `Changed ${parts.join("; ")}`;
}
