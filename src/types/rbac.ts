/**
 * The roles the frontend catalog (`ROLES` in @/constants/rbac) documents.
 *
 * `super_admin` is the platform team's role: the backend grants it every
 * permission (`Permission::all()`). It is here so screens that label a role
 * name it, never so a picker offers it: `ROLE_OPTIONS` leaves it out, and the
 * Users screen builds its role list from `GET /roles`.
 */
export type Role =
  | "super_admin"
  | "admin"
  // Keeps the books (round C). A system role nobody gets from a seeder; the
  // owner assigns it in Users.
  | "accountant"
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
  // Extensions and other post-release changes to a loan. The API gates their
  // history behind `loan_adjustments:view`, which `loans:view` does not imply.
  | "loan_adjustments"
  // Creating, editing and deleting loan products. Its own module because a
  // product sets the terms of every later application; viewing products stays
  // on `loans:view`.
  | "loan_products"
  | "payments"
  | "collections"
  | "reports"
  | "settings"
  | "fees"
  | "users"
  // Branch access. `branches:view_all` sees every branch's data; without it
  // the API limits a user to the branches they are assigned to (another
  // branch's record answers 404, a `branch_id` filter outside them 403).
  | "branches"
  | "audit_logs"
  | "share_capital"
  | "collaterals"
  | "auto_pay"
  // Crediting members' share capital in a batch (`auto_credit:process`).
  // Seeded by the API; the role editor has no checkbox for it.
  | "auto_credit"
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
  // general ledger, trial balance, financial statements — plus the privileged
  // verbs that have no other home: `reconcile`, `close`, `settings` and
  // `allowance`.
  | "accounting"
  | "chart_of_accounts"
  | "journals"
  | "expenses"
  | "cash_accounts"
  // ── Credit Scoring ──
  //
  // Internal 0-100 risk score plus a recommendation, never an automated
  // approve/deny. `view` covers every read-only screen (dashboard, borrower
  // list, borrower profile, score history, risk monitoring); `override` is
  // the human decision verb (see Action below); `settings` gates the
  // scorecard weights/thresholds and the module's privacy/versioning config,
  // mirroring `accounting:settings`.
  //
  // The verb is `settings`, NOT `configure`. The design spec
  // (`docs/superpowers/specs/2026-09-15-credit-scoring-design.md`) originally
  // said `credit_scoring:configure` and has since been corrected, but older
  // copies of it have not. The shipped code checks `credit_scoring:settings`
  // here, in `@/constants/navigation` and in `@/constants/rbac`. A backend
  // seeded from the old wording creates a permission nothing reads, and the
  // two admin screens stay dark for everyone.
  //
  // None of these three are granted by the backend today, and none should
  // be until the module's eleven endpoints exist — `credit_scoring` appears
  // nowhere in lendyph-backend (checked on `development` and `main`,
  // 2026-09-19). Every gate in this app reads `user.permissions` as the server
  // sent them, so the server withholding these is the only thing keeping seven
  // dead menu items out of production. Contract for building it:
  // `docs/CREDIT_SCORING_BACKEND_HANDOFF.md`.
  | "credit_scoring"
  // ── Automated due-date reminders ──
  //
  // `view` covers the dashboard, queue, message history and a loan's reminder
  // timeline; `send` is a manual reminder to one member; `pause` stops
  // reminders globally, per member or per loan; `settings` covers rules,
  // templates and the SMS/email provider config (it holds provider
  // credentials).
  //
  // Phase 2: the backend seeds all four for admin and super_admin only, and
  // the roles screen offers them. Nothing is sent to members: the engine runs
  // on log-only drivers, and the screens show test mode.
  | "reminders"
  // ── Savings & Deposits ──
  //
  // `view` reads products, accounts, ledgers and reports; `create` opens an
  // account or a time deposit; `transact` posts deposits, withdrawals,
  // transfers, holds and reversal requests; `close` closes an account,
  // freezes or reactivates it, and pre-terminates a time deposit; `approve`
  // decides approvals and interest runs (never the maker's own); `post` runs
  // and posts interest; `settings` manages products, rates, tax rules and the
  // approval tiers. Seeded for admin and super_admin only.
  | "savings";

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
  // Writing off a loan's remaining balance; seeded as `loans:write_off`.
  | "write_off"
  // Extending a loan's term (`loans:extend`) and resetting another user's
  // password (`users:reset_password`). Seeded by the API; the role editor has
  // no checkbox for either, and a role keeps whatever it holds on save.
  | "extend"
  | "reset_password"
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
  // Posting the allowance for credit losses (`accounting:allowance`). Its own
  // verb rather than `journals:post`, so a bookkeeper can't post one.
  | "allowance"
  | "transfer"
  // A credit score is never hand-edited — only recalculated by the backend
  // and then acted on. `override` is that act: a human records a Decision
  // (Approve/Decline/Refer/Hold) with a required Reason against a specific
  // score, writing to an immutable audit trail. Distinct from `update`
  // because nothing about the score itself changes.
  | "override"
  // Reminders: `send` contacts a member on demand, which is a different
  // risk from creating anything; `pause` silences the automated ones.
  | "send"
  | "pause"
  // Loan products: one verb for create, edit and delete, as the API seeds it.
  | "manage"
  // Expenses: settle a payable (`expenses:pay`, seeded by the server).
  | "pay"
  // Branch access: see every branch, not only the ones a user is assigned to.
  | "view_all";

export type Permission = `${Module}:${Action}`;

export interface RoleConfig {
  label: string;
  description: string;
  permissions: Permission[];
}
