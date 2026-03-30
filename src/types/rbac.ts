export type Role =
  | "admin"
  | "loan_officer"
  | "cashier"
  | "collector"
  | "viewer";

export type Module =
  | "dashboard"
  | "borrowers"
  | "loans"
  | "payments"
  | "collections"
  | "reports"
  | "settings"
  | "users";

export type Action =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "release"
  | "void"
  | "mark_collected"
  | "export";

export type Permission = `${Module}:${Action}`;

export interface RoleConfig {
  label: string;
  description: string;
  permissions: Permission[];
}
