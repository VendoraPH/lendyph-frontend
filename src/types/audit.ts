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
  | "attachment_removed";

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
