export type Role =
  | "admin"
  | "loan_officer"
  | "loan_processor"
  | "cashier"
  | "general_bookkeeper"
  | "collector"
  | "viewer"
  | "manager"
  | "bod1"
  | "bod2"
  | "bod3"
  | "bod4"
  | "bod5"
  | "bod6"
  | "bod7";

export type Module =
  | "dashboard"
  | "borrowers"
  | "loans"
  | "payments"
  | "collections"
  | "reports"
  | "settings"
  | "users"
  | "audit_logs"
  | "share_capital"
  | "collaterals"
  | "auto_pay"
  | "gcash";

export type Action =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "release"
  // Restructuring closes a loan and opens a replacement, so the API gates it
  // behind its own permission rather than plain `loans:create`.
  | "restructure"
  | "void"
  | "mark_collected"
  | "export"
  | "process"
  | "toggle"
  | "transact"
  | "settings";

export type Permission = `${Module}:${Action}`;

export interface RoleConfig {
  label: string;
  description: string;
  permissions: Permission[];
}
