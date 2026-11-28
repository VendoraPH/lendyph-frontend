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
  // AMLA compliance (Phase 6): every AMLA permission, every branch, and
  // read-only lending, savings and GCash. A system role nobody gets from a
  // seeder; the owner assigns it in Users.
  | "compliance_officer"
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
  // Settings → Menu Visibility (finish run round 6): which side-menu modules
  // this deployment shows. `menu_visibility:manage` opens the page, which also
  // asks for the administrator password the server checks.
  | "menu_visibility"
  | "fees"
  // Settings → Penalties (overdue-day penalty brackets per loan product).
  | "penalties"
  | "users"
  // Branch access. `branches:view_all` sees every branch's data; without it
  // the API limits a user to the branches they are assigned to (another
  // branch's record answers 404, a `branch_id` filter outside them 403).
  // `branches:manage` (Phase 6) adds, edits, opens and closes branches, and
  // also needs `view_all`.
  | "branches"
  // ── Interbranch Transfers (Phase 6) ──
  //
  // Money moved between branches through 1190 Interbranch Clearing. `view`
  // reads them, `create` starts one, `approve` approves it (never the
  // maker's own) and `receive` confirms it at the receiving branch.
  | "interbranch_transfers"
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
  // ── CIC reporting (Phase 10) ──
  //
  // Credit Submission Data Files for the Credit Information Corporation.
  // `view` = readiness, records, issues, captures and history;
  // `prepare` = generate a file, take a test or correction capture, loan
  // overrides; `submit` = encrypt, download and record it as sent;
  // `review` = record CIC's answer (never the file's generator);
  // `settings` = settings, CIC's public key, product and code mappings.
  // lendyph-backend seeds them for admin and super_admin; each also needs
  // `branches:view_all`.
  | "cic"
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
  // ── Loan Origination ──
  //
  // `view` reads applications, links, assessments and documents; `update`
  // verifies documents, assigns officers, writes notes, requests information,
  // links a member, moves an application between review steps and submits it
  // for approval (approval itself runs through the existing loan approval
  // chain); `assess` re-runs and annotates the preliminary assessment;
  // `convert` turns an approved application into a loan; `settings` edits
  // public links and the module's settings. Seeded for admin and super_admin
  // only (Phase 6, X0), never loan officers.
  | "loan_origination"
  // ── Savings & Deposits ──
  //
  // `view` reads products, accounts, ledgers and reports; `create` opens an
  // account or a time deposit; `transact` posts deposits, withdrawals,
  // transfers, holds and reversal requests; `close` closes an account,
  // freezes or reactivates it, and pre-terminates a time deposit; `approve`
  // decides approvals and interest runs (never the maker's own); `post` runs
  // and posts interest; `settings` manages products, rates, tax rules and the
  // approval tiers. Seeded for admin and super_admin only.
  | "savings"
  // ── CDA Compliance ──
  //
  // The annual CDA reports, their registers and filings. `view` reads the
  // dashboard, reports and registers; `prepare` edits drafts and sends them
  // for review; `upload` adds compliance documents; `review` returns a report;
  // `approve`, `finalize`, `reopen` and `submit` (recording the filing) are
  // each their own step; `export` asks the server for a PDF or Excel copy;
  // `settings` covers the regulatory profile, deadlines and extensions. The
  // registers have their own `manage_*` verbs. Mediation, audit and tax
  // reports are also read-restricted (`view_mediation`, `view_audit`,
  // `view_tax`). Every CDA permission works only with `branches:view_all`.
  // Seeded for admin and super_admin only.
  | "cda"
  // ── Member Portal (staff side) ──
  //
  // `view` reads the portal counts, the accounts list, a member's access card
  // and communications; `invite` issues activation and password reset codes;
  // `manage` turns a member's access off or on, unlocks, signs out everywhere
  // and shares documents; `requests` works the members' requests queue;
  // `announcements` writes announcements to members; `settings` covers the
  // portal settings and terms (with `branches:view_all`). Everything is
  // branch-scoped by the server. Seeded for admin and super_admin only.
  | "member_portal"
  // ── Linda (AI assistant) ──
  //
  // `use` asks Linda questions (the header button, its panel and the entries
  // on the dashboard and a member's credit profile); `settings` chooses the AI
  // model in Settings → Linda, which also needs `branches:view_all`. Seeded for
  // admin and super_admin only. Revoking `use` is the instant off switch.
  | "linda"
  // ── AMLA Compliance (Phase 6) ──
  //
  // `view` reads the AMLA dashboard and reports; `alerts` works monitoring
  // alerts; `cases` runs cases; `cdd` keeps due diligence and AML risk;
  // `screening` screens members against the uploaded watchlists; `sanctions`
  // places and lifts holds for an AMLA order; `ctr` and `str` prepare
  // covered and suspicious transaction reports; `approve` approves a report
  // someone else prepared; `export` makes the filing files; `submit` records
  // a filing with the AMLC; `settings` changes settings, rules and the
  // calendar (a second holder approves); `audit` reads AMLA's own log. Seeded
  // for admin, super_admin and the Compliance Officer only.
  | "amla";

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
  // Editing a loan while it waits at the holder's approval step
  // (`loans:edit_in_approval`). Seeded for the Chairman/Chairwoman's role
  // (`bod1`) alone: not admin, not super_admin.
  | "edit_in_approval"
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
  | "view_all"
  // ── CDA Compliance verbs (see the `cda` module above) ──
  | "prepare"
  | "upload"
  | "review"
  | "finalize"
  | "reopen"
  | "submit"
  | "manage_officers"
  | "manage_social"
  | "manage_mediation"
  | "view_mediation"
  | "view_audit"
  | "view_tax"
  // ── Member Portal verbs (see the `member_portal` module above) ──
  | "invite"
  | "requests"
  | "announcements"
  // ── Loan Origination verbs (see the `loan_origination` module above) ──
  | "assess"
  | "convert"
  // Linda: asking it questions (`linda:use`).
  | "use"
  // ── AMLA verbs (see the `amla` module above) ──
  | "alerts"
  | "cases"
  | "cdd"
  | "screening"
  | "sanctions"
  | "ctr"
  | "str"
  | "audit"
  // The executive dashboard (`dashboard:analytics`), beside `dashboard:view`,
  // which every role holds.
  | "analytics"
  // Interbranch transfers: confirming one at the receiving branch.
  | "receive";

export type Permission = `${Module}:${Action}`;

export interface RoleConfig {
  label: string;
  description: string;
  permissions: Permission[];
}
