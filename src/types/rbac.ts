/**
 * KNOWN GAP — `super_admin` is missing from this union, and it is a real role
 * on the API side: the backend grants `imports:process` to `super_admin` and
 * `admin`. The gate is unaffected (it reads `user.permissions`, never this
 * list), but every screen that LABELS a role goes through `ROLES[role]` and
 * therefore has no entry for it:
 *
 *   - `AccessDenied` renders the badge as "Unknown".
 *   - `user-roles` falls back to `titleCase(key)` → "Super Admin", which reads
 *     fine but carries no description and no seeded permission list.
 *
 * Not fixed here on purpose. `ROLES` is `Record<Role, RoleConfig>`, so adding
 * the key also adds a row to `ROLE_OPTIONS`, which is the list a role picker
 * would offer — making the highest-privilege role assignable from the UI is a
 * product decision, not a typo fix. Raised with the lead.
 */
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
  | "gcash"
  // CSV migration. Its own module rather than an action on `borrowers` or
  // `loans`, because one import writes BOTH — a permission that named either
  // one would have to be granted to everyone who edits that half of the book,
  // and this is the only screen that can create members and loans in bulk
  // without an approval chain. The backend migration grants `imports:process`
  // to `super_admin` and `admin` only.
  | "imports"
  // ── Accounting ──
  //
  // Split across five modules rather than collapsed into one, because the
  // people differ: a bookkeeper drafts journals but must not post them, an
  // accountant posts and closes periods, and a branch manager reads statements
  // without touching either. One `accounting:*` module would force all of that
  // through a single grant.
  //
  // `accounting` itself covers the read-only reporting surface — dashboard,
  // general ledger, trial balance, financial statements — plus the three
  // privileged verbs that have no other home: `reconcile`, `close`, `settings`.
  | "accounting"
  | "chart_of_accounts"
  | "journals"
  | "expenses"
  | "cash_accounts";

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
  | "settings"
  // ── Accounting verbs ──
  //
  // `post` is deliberately separate from `create`: drafting a journal changes
  // nothing, while posting it moves the books and cannot be undone except by a
  // reversal. That is the line between a bookkeeper and an accountant, and it
  // is the reason a loan collector with `journals:create` still cannot alter
  // the financial record.
  | "post"
  | "reverse"
  | "reconcile"
  | "close"
  | "transfer";

export type Permission = `${Module}:${Action}`;

export interface RoleConfig {
  label: string;
  description: string;
  permissions: Permission[];
}
