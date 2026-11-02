// How an audit row reads on the Audit Trail: its module, action, user and
// description. Dependency-free so it is unit-testable under `tsx --test`.

import type { AuditLog } from "@/types";

const MODULE_LABELS: Record<string, string> = {
  auth: "Auth",
  borrowers: "Borrowers",
  loans: "Loans",
  payments: "Payments",
  collections: "Collections",
  users: "Users",
  reports: "Reports",
};

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
 * The row's module. `AuditLogResource` files Role rows under `users`; they read
 * as Roles, by the record they are about.
 */
export function auditModuleLabel(log: Pick<AuditLog, "module" | "target">): string {
  if (log.target?.type === "Role") return "Roles";
  return MODULE_LABELS[log.module] ?? inWords(log.module);
}

/** The row's action: a known label, or the server's key in words. */
export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? inWords(action);
}

/** Who did it. A row with no user (a login attempt, a job) is the System. */
export function auditUserName(log: Pick<AuditLog, "user">): string {
  return log.user?.full_name?.trim() || "System";
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
    (c) => `${c.field.split("_").join(" ")}: ${c.old ?? "—"} → ${c.new ?? "—"}`
  );
  return `Changed ${parts.join("; ")}`;
}
