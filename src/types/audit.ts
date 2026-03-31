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
  | "status_changed";

export type AuditModule =
  | "auth"
  | "borrowers"
  | "loans"
  | "payments"
  | "collections"
  | "users"
  | "reports";

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
