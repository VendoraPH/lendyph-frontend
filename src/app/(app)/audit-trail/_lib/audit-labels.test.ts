import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AuditLog } from "@/types";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_MODULE_OPTIONS,
  auditActionLabel,
  auditChangePair,
  auditChangeValue,
  auditDescription,
  auditFieldLabel,
  auditModuleLabel,
  auditTargetType,
  auditTargetLabel,
  auditTargetTypeLine,
  auditUserName,
  auditUserRole,
} from "./audit-labels";

function log(overrides: Partial<AuditLog>): AuditLog {
  return {
    id: 1,
    user: { id: 7, full_name: "Ana Reyes", roles: ["admin"] },
    action: "updated",
    module: "users",
    description: "",
    target: null,
    changes: [],
    ip_address: "127.0.0.1",
    created_at: "2026-11-02T00:00:00Z",
    ...overrides,
  };
}

const role = { id: 3, type: "Role", label: "cashier" };

test("a role row is labelled Roles, though the server files it under users", () => {
  assert.equal(auditModuleLabel(log({ module: "users", target: role })), "Roles");
  assert.equal(auditModuleLabel(log({ module: "users", target: { id: 7, type: "User", label: "Ana" } })), "Users");
  assert.equal(auditModuleLabel(log({ module: "loans", target: null })), "Loans");
});

test("a module the screen does not know reads as its key in words", () => {
  assert.equal(auditModuleLabel(log({ module: "share_capital" as AuditLog["module"] })), "Share capital");
});

test("role permission changes read as Permissions changed", () => {
  assert.equal(auditActionLabel("role_permissions_changed"), "Permissions changed");
});

test("known actions keep their labels and any other key reads in words", () => {
  assert.equal(auditActionLabel("updated"), "Updated");
  assert.equal(auditActionLabel("reset_password"), "Reset Password");
  assert.equal(auditActionLabel("branches_changed"), "Branches changed");
  assert.equal(auditActionLabel("loan_step_sent_back"), "Loan step sent back");
});

test("a row with no user is System, never a placeholder", () => {
  assert.equal(auditUserName(log({ user: null as unknown as AuditLog["user"] })), "System");
  assert.equal(auditUserName(log({ user: { id: 7, full_name: "  ", roles: [] } })), "System");
  assert.equal(auditUserName(log({})), "Ana Reyes");
});

test("a row's own description wins", () => {
  assert.equal(auditDescription(log({ description: "Role cashier updated" })), "Role cashier updated");
});

test("a role update with no description lists its changed fields from old and new values", () => {
  const row = log({
    target: role,
    description: "",
    changes: [
      { field: "display_name", old: null, new: "Teller" },
      { field: "description", old: "Takes payments", new: "Takes payments and cash in" },
    ],
  });
  assert.equal(
    auditDescription(row),
    "Changed display name: — → Teller; description: Takes payments → Takes payments and cash in"
  );
});

test("a row with neither a description nor changes stays blank", () => {
  assert.equal(auditDescription(log({ description: null as unknown as string })), "");
});

test("rows the server files under roles read Roles", () => {
  assert.equal(auditModuleLabel(log({ module: "roles", target: role })), "Roles");
  assert.equal(auditModuleLabel(log({ module: "roles", target: null })), "Roles");
});

test("a changed field reads with every underscore as a space", () => {
  assert.equal(auditFieldLabel("insurance_remaining_balance"), "insurance remaining balance");
  assert.equal(auditFieldLabel("status"), "status");
});

test("a multi-word changed field reads in words in the description", () => {
  const row = log({ changes: [{ field: "interest_rate_frequency", old: "monthly", new: "annual" }] });
  assert.equal(auditDescription(row), "Changed interest rate frequency: monthly → annual");
});

test("the user's role reads by its label, every underscore a space", () => {
  assert.equal(auditUserRole(log({ user: { id: 7, full_name: "Ana", roles: ["general_bookkeeper"] } })), "General Bookkeeper");
  assert.equal(auditUserRole(log({ user: { id: 7, full_name: "Ana", roles: ["branch_head_officer"] } })), "Branch Head Officer");
  assert.equal(auditUserRole(log({ user: { id: 7, full_name: "Ana", roles: [] } })), "");
  assert.equal(auditUserRole(log({ user: null as unknown as AuditLog["user"] })), "");
});

test("system rows (accounting, GCash, imports, no record) read System", () => {
  assert.equal(auditModuleLabel(log({ module: "system", target: null })), "System");
});

// Phase 4 (B2): penalty configuration rows carry module `penalties`.
test("penalty configuration rows read under Penalties", () => {
  assert.equal(auditModuleLabel(log({ module: "penalties", target: null })), "Penalties");
});

test("accounting and GCash rows read by their module names", () => {
  assert.equal(auditModuleLabel(log({ module: "accounting", target: null })), "Accounting");
  assert.equal(auditModuleLabel(log({ module: "gcash", target: null })), "GCash");
});

test("the module filter offers exactly the modules the server filters by", () => {
  assert.deepEqual(
    AUDIT_MODULE_OPTIONS.map((o) => o.value).sort(),
    // Backend AuditLogModules::all(): every module in MODULE_MAP, plus auth and system.
    [
      "accounting",
      "auth",
      "borrowers",
      "cda",
      "collections",
      "credit_scoring",
      "gcash",
      "loans",
      "member_portal",
      "payments",
      "penalties",
      "reminders",
      "roles",
      "savings",
      "system",
      "users",
    ]
  );
  assert.ok(AUDIT_MODULE_OPTIONS.every((o) => o.label === auditModuleLabel({ module: o.value, target: null })));
});

test("every module filter option reads in words, by its menu name", () => {
  const labels = Object.fromEntries(AUDIT_MODULE_OPTIONS.map((o) => [o.value, o.label]));
  assert.equal(labels.reminders, "Reminders");
  assert.equal(labels.credit_scoring, "Credit Scoring");
  assert.equal(labels.savings, "Savings");
  assert.equal(labels.cda, "CDA Compliance");
  assert.equal(labels.member_portal, "Member Portal");
  assert.equal(labels.penalties, "Penalties");
  assert.ok(AUDIT_MODULE_OPTIONS.every((o) => !/_/.test(o.label) && o.label !== o.value));
});

test("a deleted row with no description lists the old values, without id or timestamps", () => {
  const row = log({
    action: "deleted",
    target: role,
    changes: [
      { field: "id", old: "17", new: null },
      { field: "name", old: "ops_lead", new: null },
      { field: "display_name", old: null, new: null },
      { field: "description", old: "Runs operations", new: null },
      { field: "created_at", old: "2026-10-01T00:00:00Z", new: null },
      { field: "updated_at", old: "2026-10-02T00:00:00Z", new: null },
      { field: "deleted_at", old: null, new: "2026-11-02T00:00:00Z" },
    ],
  });
  assert.equal(auditDescription(row), "Deleted: name ops_lead, description Runs operations");
});

test("a deleted row with nothing meaningful left reads Deleted with the record's label", () => {
  assert.equal(
    auditDescription(log({ action: "deleted", target: role, changes: [{ field: "id", old: "17", new: null }] })),
    "Deleted: cashier"
  );
  assert.equal(auditDescription(log({ action: "deleted", target: null })), "Deleted");
});

test("a created row with no description reads Created with the record's label", () => {
  assert.equal(auditDescription(log({ action: "created", target: role })), "Created: cashier");
  assert.equal(
    auditDescription(
      log({ action: "created", target: role, changes: [{ field: "name", old: null, new: "cashier" }] })
    ),
    "Created: cashier"
  );
  assert.equal(auditDescription(log({ action: "created", target: null })), "Created");
});

test("a created or deleted row's own description still wins", () => {
  assert.equal(auditDescription(log({ action: "created", target: role, description: "Role created" })), "Role created");
  assert.equal(auditDescription(log({ action: "deleted", target: role, description: "Role deleted" })), "Role deleted");
});

const loanTarget = { id: 9, type: "Loan", label: "LN-0009" };

test("a loan's status change reads the app's labels, not raw keys", () => {
  const row = log({ target: loanTarget });
  assert.equal(auditChangeValue(row, "status", "for_review"), "For Approval");
  assert.equal(auditChangeValue(row, "status", "ongoing"), "Current");
  assert.equal(auditChangeValue(row, "status", "void"), "Voided");
});

test("a loan's status change in the summary line reads the same labels", () => {
  const row = log({
    target: loanTarget,
    changes: [{ field: "status", old: "draft", new: "for_review" }],
  });
  assert.equal(auditDescription(row), "Changed status: Draft → For Approval");
});

test("a status on any other record reads in words with a capital", () => {
  const user = log({ target: { id: 7, type: "User", label: "Ana" } });
  assert.equal(auditChangeValue(user, "status", "approved"), "Approved");
  const journal = log({ target: { id: 3, type: "AccountingJournal", label: "JE-000001" } });
  assert.equal(auditChangeValue(journal, "status", "draft"), "Draft");
  assert.equal(auditChangeValue(journal, "status", "posted"), "Posted");
  const expense = log({ target: { id: 4, type: "Expense", label: "EXP-1" } });
  assert.equal(auditChangeValue(expense, "status", "partially_paid"), "Partially paid");
  assert.equal(auditChangeValue(log({ target: null }), "status", "pending"), "Pending");
});

test("a status field by another name reads in words too", () => {
  const row = log({ target: { id: 3, type: "Borrower", label: "Ana" } });
  assert.equal(auditChangeValue(row, "approval_status", "pending"), "Pending");
});

test("for_review reads For Approval on every record, never For review", () => {
  const step = log({ target: { id: 3, type: "LoanApprovalStep", label: "Manager" } });
  assert.equal(auditChangeValue(step, "status", "for_review"), "For Approval");
});

test("a value the server already worded keeps its words", () => {
  const row = log({ target: { id: 3, type: "Expense", label: "EXP-1" } });
  assert.equal(auditChangeValue(row, "status", "Partially Paid"), "Partially Paid");
});

test("only status fields are relabelled", () => {
  assert.equal(auditChangeValue(log({ target: loanTarget }), "purpose", "for_review"), "for_review");
  assert.equal(auditChangeValue(log({ target: loanTarget }), "frequency", "Semi-Monthly"), "Semi-Monthly");
});

test("a loan status the app has no label for reads in words, and a missing value stays missing", () => {
  const row = log({ target: loanTarget });
  assert.equal(auditChangeValue(row, "status", "someday"), "Someday");
  assert.equal(auditChangeValue(row, "status", null), null);
});

test("a user's branches read Branches, not Branch Ids", () => {
  assert.equal(auditFieldLabel("branch_ids"), "branches");
  const row = log({ changes: [{ field: "branch_ids", old: null, new: "Main Office" }] });
  assert.equal(auditDescription(row), "Changed branches: — → Main Office");
});

test("an audit target reads in words, and a member's reads Member, not the class name", () => {
  assert.equal(auditTargetType("Borrower"), "Member");
  assert.equal(auditTargetType("BorrowerDocument"), "Member document");
  assert.equal(auditTargetType("Loan"), "Loan");
  assert.equal(auditTargetType("CoMaker"), "Co-maker");
  assert.equal(auditTargetType("LoanApprovalStep"), "Loan approval step");
  assert.equal(auditTargetType("GCashTransaction"), "GCash transaction");
});

test("a target with no name reads once: the type and id line is skipped when it repeats the label", () => {
  const target = { id: 1, type: "AccountingReconciliationLine", label: "Accounting reconciliation line #1" };
  assert.equal(auditTargetType(target.type), "Accounting reconciliation line");
  assert.equal(auditTargetTypeLine(target), null);
  // Case and spacing don't make it different.
  assert.equal(auditTargetTypeLine({ ...target, label: "  ACCOUNTING  Reconciliation line # 1 " }), null);
  assert.equal(auditTargetTypeLine({ id: 21, type: "CoMaker", label: "Co-maker #21" }), null);
});

test("a named target keeps its type and id line", () => {
  assert.equal(
    auditTargetTypeLine({ id: 12, type: "AccountingJournal", label: "JE-000012" }),
    "Journal entry #12",
  );
  // Another record of the same type is not a repeat.
  assert.equal(
    auditTargetTypeLine({ id: 2, type: "AccountingReconciliationLine", label: "Accounting reconciliation line #1" }),
    "Accounting reconciliation line #2",
  );
});

test("the audit detail prints the type and id line through auditTargetTypeLine", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/audit-trail/page.tsx"), "utf8");
  assert.ok(page.includes("auditTargetTypeLine(log.target)"));
  assert.ok(!page.includes("{auditTargetType(log.target.type)} #{log.target.id}"));
});

test("the module filter says Members and still sends borrowers", () => {
  const option = AUDIT_MODULE_OPTIONS.find((o) => o.value === "borrowers");
  assert.equal(option?.label, "Members");
});

test("id fields the server sends as names read without Id", () => {
  assert.equal(auditFieldLabel("branch_id"), "branch");
  assert.equal(auditFieldLabel("account_officer_id"), "account officer");
  assert.equal(auditFieldLabel("applicable_product_ids"), "applicable products");
  assert.equal(auditFieldLabel("loan_product_id"), "loan product");
});

const roleRow = log({ target: role });

test("a role's permissions read in words on both sides", () => {
  assert.equal(
    auditChangeValue(roleRow, "permissions", "auto_pay:view, borrowers:view, loans:write_off"),
    "Auto-Pay: View, Members: View, Loans: Write Off",
  );
  const pair = auditChangePair(roleRow, { field: "permissions", old: "borrowers:view", new: "borrowers:view, gcash:transact" });
  assert.deepEqual(pair, { old: "Members: View", new: "Members: View, GCash: Transact" });
});

test("a permission value that isn't a key stays as it is", () => {
  assert.equal(auditChangeValue(roleRow, "permissions", "borrowers:view, 3 more"), "Members: View, 3 more");
  assert.equal(auditChangeValue(roleRow, "permissions", "none"), "none");
});

test("two statuses that read the same show each side's stored status in words", () => {
  const row = log({ target: loanTarget });
  assert.deepEqual(auditChangePair(row, { field: "status", old: "released", new: "ongoing" }), {
    old: "Released",
    new: "Ongoing",
  });
  assert.equal(
    auditDescription(log({ target: loanTarget, changes: [{ field: "status", old: "released", new: "ongoing" }] })),
    "Changed status: Released → Ongoing",
  );
});

test("statuses that read differently keep the app's labels", () => {
  const row = log({ target: loanTarget });
  assert.deepEqual(auditChangePair(row, { field: "status", old: "draft", new: "for_review" }), {
    old: "Draft",
    new: "For Approval",
  });
  assert.deepEqual(auditChangePair(row, { field: "status", old: null, new: "ongoing" }), { old: null, new: "Current" });
});

test("more id fields the server sends as names read without Id", () => {
  assert.equal(auditFieldLabel("step_id"), "step");
  assert.equal(auditFieldLabel("source_loan_id"), "source loan");
  assert.equal(auditFieldLabel("restructured_into_loan_id"), "restructured into loan");
  assert.equal(auditFieldLabel("inherited_collateral_ids"), "inherited collaterals");
});

const productTarget = { id: 4, type: "LoanProduct", label: "Salary Loan" };

test("a loan product's fields read as the product form names them", () => {
  const product = { type: "LoanProduct" };
  assert.equal(auditFieldLabel("max_scb", product), "Maximum Share Capital Build-Up");
  assert.equal(auditFieldLabel("min_scb", product), "Minimum Share Capital Build-Up");
  assert.equal(auditFieldLabel("scb_required", product), "Share Capital Build-Up Required");
  assert.equal(auditFieldLabel("term", product), "Default Term");
  assert.equal(auditFieldLabel("grace_period_days", product), "Grace Period");
  assert.equal(
    auditDescription(log({ target: productTarget, changes: [{ field: "max_scb", old: "₱100.00", new: "₱200.00" }] })),
    "Changed Maximum Share Capital Build-Up: ₱100.00 → ₱200.00",
  );
});

test("the same field on another record keeps its plain words", () => {
  assert.equal(auditFieldLabel("max_scb", { type: "Loan" }), "max scb");
  assert.equal(auditFieldLabel("term"), "term");
});

// The audited reminders models (backend #232; filed under the `reminders`
// module by AuditLogModules). Member preferences read "Member", never
// "Borrower".
test("reminder audit targets read in plain words", () => {
  assert.equal(auditTargetType("ReminderSetting"), "Reminder settings");
  assert.equal(auditTargetType("ReminderBranchSetting"), "Branch reminder settings");
  assert.equal(auditTargetType("ReminderRule"), "Reminder rule");
  assert.equal(auditTargetType("ReminderTemplate"), "Reminder template");
  assert.equal(auditTargetType("ReminderPause"), "Reminder pause");
  assert.equal(auditTargetType("BorrowerNotificationPreference"), "Member reminder preferences");
});

test("reminder rows read under the Reminders module", () => {
  assert.equal(
    auditModuleLabel(log({ module: "reminders" as AuditLog["module"], target: { id: 1, type: "ReminderRule", label: "Due today" } })),
    "Reminders",
  );
});

// Round 2: document and attachment rows are written as `uploaded` and
// `attachment_removed`, so the Action filter offers both, in words.
test("the Action filter offers Uploaded and Attachment removed", () => {
  const options = new Map(AUDIT_ACTION_OPTIONS.map((o) => [o.value, o.label]));
  assert.equal(options.get("uploaded"), "Uploaded");
  assert.equal(options.get("attachment_removed"), "Attachment removed");
  assert.equal(auditActionLabel("uploaded"), "Uploaded");
  assert.equal(auditActionLabel("attachment_removed"), "Attachment removed");
  for (const { value, label } of AUDIT_ACTION_OPTIONS) assert.equal(auditActionLabel(value), label, value);
  assert.equal(new Set(options.keys()).size, AUDIT_ACTION_OPTIONS.length);
});

test("the Audit Trail's Action filter is built from AUDIT_ACTION_OPTIONS", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/audit-trail/page.tsx"), "utf8");
  assert.match(page, /\.\.\.AUDIT_ACTION_OPTIONS\]/);
});

// f2d-be: voiding a loan that still had approvals pending cancels them and
// writes `loan_chain_cancelled`.
test("the Action filter offers Approvals cancelled", () => {
  const option = AUDIT_ACTION_OPTIONS.find((o) => o.value === "loan_chain_cancelled");
  assert.equal(option?.label, "Approvals cancelled");
  assert.equal(auditActionLabel("loan_chain_cancelled"), "Approvals cancelled");
});

// Journal links on accounting rows (f2e-be words their values as "JE-000014"),
// so the field names read in words too, never "reversed by journal id".
test("journal id fields read in words", () => {
  assert.equal(auditFieldLabel("reversed_by_journal_id"), "reversed by");
  assert.equal(auditFieldLabel("matched_journal_line_id"), "matched to");
  assert.equal(auditFieldLabel("reverses_journal_id"), "reverses");
  assert.equal(auditFieldLabel("journal_id"), "journal");
  assert.equal(auditFieldLabel("accounting_journal_id"), "journal");
});

test("savings rows read their module, actions, targets and statuses in words", () => {
  assert.equal(auditModuleLabel({ module: "savings", target: null }), "Savings");
  assert.equal(auditActionLabel("time_deposit_preterminated"), "Time deposit pre-terminated");
  assert.equal(auditActionLabel("savings_account_reactivated"), "Account reactivated");
  assert.equal(auditTargetType("TimeDeposit"), "Time deposit");
  assert.equal(auditTargetType("SavingsApproval"), "Savings approval request");
  const td = log({ module: "savings", target: { id: 4, type: "TimeDeposit", label: "TD-2026-000004" } });
  assert.equal(auditChangeValue(td, "status", "preterminated"), "Pre-terminated");
  assert.equal(auditChangeValue(td, "status", "rolled_over"), "Rolled over");
  const account = log({ module: "savings", target: { id: 2, type: "SavingsAccount", label: "SAV-2026-000002" } });
  assert.equal(auditChangeValue(account, "status", "dormant"), "Dormant");
  const hold = log({ module: "savings", target: { id: 3, type: "SavingsHold", label: "Hold #3" } });
  assert.equal(auditChangeValue(hold, "status", "expired"), "Expired");
  const approval = log({ module: "savings", target: { id: 5, type: "SavingsApproval", label: "#5" } });
  assert.equal(auditChangeValue(approval, "status", "cancelled"), "Cancelled");
  const run = log({ module: "savings", target: { id: 6, type: "SavingsInterestRun", label: "#6" } });
  assert.equal(auditChangeValue(run, "status", "posted"), "Posted");
  assert.ok(AUDIT_ACTION_OPTIONS.some((o) => o.value === "time_deposit_preterminated"));
});

test("savings servicing rows (gap round S3 and S4) read their actions and targets in words", () => {
  assert.equal(auditActionLabel("savings_share_capital_transfer"), "Transferred to share capital");
  assert.equal(auditActionLabel("savings_auto_credit_run"), "Auto-credit run processed");
  assert.equal(auditActionLabel("savings_account_note_added"), "Note added");
  assert.equal(auditActionLabel("savings_outflow_hold_lifted"), "Outflow hold lifted");
  assert.equal(auditTargetType("SavingsAutoCreditInstruction"), "Savings auto-credit instruction");
  assert.equal(auditTargetType("SavingsAutoCreditRun"), "Savings auto-credit run");
});

test("savings id fields read without \"id\"", () => {
  const cases: Array<[string, string]> = [
    ["result_transaction_id", "result transaction"],
    ["reverses_transaction_id", "reversed transaction"],
    ["counterpart_transaction_id", "counterpart transaction"],
    ["interest_transaction_id", "interest transaction"],
    ["tax_transaction_id", "tax transaction"],
    ["funding_transaction_id", "funding transaction"],
    ["target_transaction_id", "target transaction"],
    ["interest_run_id", "interest run"],
    ["time_deposit_id", "time deposit"],
    ["payout_account_id", "payout account"],
  ];
  for (const [field, label] of cases) assert.equal(auditFieldLabel(field), label, field);
  const approval = { type: "SavingsApproval" };
  assert.equal(auditFieldLabel("account_id", approval), "savings account");
  assert.equal(auditFieldLabel("borrower_id", { type: "TimeDeposit" }), "member");
  assert.equal(auditFieldLabel("run_id", { type: "SavingsInterestRunLine" }), "interest run");
  // Outside savings a plain id keeps its general words.
  assert.equal(auditFieldLabel("account_id", { type: "AccountingJournalLine" }), "account id");
});

test("CDA rows read their module, actions and targets in words", () => {
  assert.equal(auditModuleLabel({ module: "cda", target: null }), "CDA Compliance");
  assert.equal(auditActionLabel("cda_workflow"), "Report workflow");
  assert.equal(auditActionLabel("cda_report_saved"), "Report saved");
  assert.equal(auditActionLabel("cda_report_refreshed"), "Report refreshed");
  assert.equal(auditActionLabel("cda_export_generated"), "Report exported");
  assert.equal(auditActionLabel("cda_review_chain_updated"), "Review chain changed");
  assert.equal(auditActionLabel("year_end_captured"), "Year-end figures captured");
  assert.equal(auditTargetType("CdaReport"), "CDA report");
  assert.equal(auditTargetType("CdaMediationCase"), "Mediation case");
  assert.equal(auditTargetType("CdaOfficerTraining"), "Officer training");
  assert.equal(auditTargetType("CdaReportingPeriod"), "CDA reporting period");
  assert.equal(auditFieldLabel("due_override_on"), "due override on");
  // A CDA class the screen has no words of its own for still reads "CDA …".
  assert.equal(auditTargetType("CdaDocument"), "CDA document");
  assert.equal(auditTargetType("CdaExportTemplateFile"), "CDA export template file");
  assert.equal(auditTargetType("CdaNoticeSent"), "CDA notice");
});

test("the type and id line shows as worded, never re-cased by CSS", () => {
  // "CDA document #1" stays "CDA document #1" (a `capitalize` class made it
  // "CDA Document #1"); the other types read exactly as before, in their words.
  assert.equal(auditTargetTypeLine({ id: 1, type: "CdaDocument", label: "Signed CAPR" }), "CDA document #1");
  assert.equal(auditTargetTypeLine({ id: 12, type: "AccountingJournal", label: "JE-000012" }), "Journal entry #12");
  assert.equal(auditTargetTypeLine({ id: 4, type: "TimeDeposit", label: "TD-2026-000004" }), "Time deposit #4");
  assert.equal(auditTargetTypeLine({ id: 7, type: "Borrower", label: "Ana Cruz" }), "Member #7");
  const page = readFileSync(join(process.cwd(), "src/app/(app)/audit-trail/page.tsx"), "utf8");
  const line = page.split("\n").findIndex((l) => l.includes("{auditTargetTypeLine(log.target)}"));
  assert.ok(line > 0);
  assert.doesNotMatch(page.split("\n")[line - 1], /capitalize/);
});

// The target types the server sends are the audited models' class basenames
// (AuditLogResource, `class_basename($auditable_type)`); `JournalEntry` is a
// frontend type the server never sends.
test("the server's accounting and other odd class names read as the menu names them", () => {
  const words: Record<string, string> = {
    AccountingJournal: "Journal entry",
    AccountingJournalLine: "Journal entry line",
    AccountingAccount: "Account",
    AccountingAccountMapping: "Account mapping",
    AccountingAllowancePosting: "Allowance for credit losses posting",
    AccountingExpense: "Expense",
    AccountingExpensePayment: "Expense payment",
    AccountingOpeningBalance: "Opening balance",
    AccountingYearClose: "Year-end close",
    GCashNonMember: "GCash walk-in",
    CsvImportRun: "Data import",
    PenaltyConfig: "Penalty configuration",
  };
  for (const [type, label] of Object.entries(words)) assert.equal(auditTargetType(type), label, type);
});

test("names that already read right are kept", () => {
  assert.equal(auditTargetType("AccountingReconciliationLine"), "Accounting reconciliation line");
  assert.equal(auditTargetType("AccountingPeriod"), "Accounting period");
  assert.equal(auditTargetType("LoanApprovalStep"), "Loan approval step");
  assert.equal(auditTargetType("ShareCapitalPledge"), "Share capital pledge");
  assert.equal(auditTargetType("GCashTransaction"), "GCash transaction");
});

test("a target the server could only name by its class reads in this screen's words, once", () => {
  const draft = { id: 557, type: "AccountingJournal", label: "Accounting journal #557" };
  assert.equal(auditTargetLabel(draft), "Journal entry #557");
  assert.equal(auditTargetTypeLine(draft), null);
  const posted = { id: 1, type: "AccountingJournal", label: "JE-2026-000001" };
  assert.equal(auditTargetLabel(posted), "JE-2026-000001");
  assert.equal(auditTargetTypeLine(posted), "Journal entry #1");
  assert.equal(auditTargetLabel({ id: 3, type: "CdaDocument", label: "CDA document #3" }), "CDA document #3");
});

// Member Portal (portal design §5): a member's own action has no staff user;
// the server names them in `actor_label`.
test("a member's own portal action reads as the server names the member, under Member Portal", () => {
  const row = log({
    user: null as unknown as AuditLog["user"],
    actor_type: "member",
    actor_label: "Member: Juan Dela Cruz (BRW-000012)",
    action: "portal_signed_in" as AuditLog["action"],
    module: "member_portal",
  });
  assert.equal(auditUserName(row), "Member: Juan Dela Cruz (BRW-000012)");
  assert.equal(auditUserRole(row), "Member Portal");
  assert.equal(auditModuleLabel(row), "Member Portal");
  assert.equal(auditActionLabel("portal_signed_in"), "Signed in to the portal");
});

test("a member row without a label still reads as a member, never the System", () => {
  const row = log({ user: null as unknown as AuditLog["user"], actor_type: "member", actor_label: null });
  assert.equal(auditUserName(row), "Member");
});

test("staff and system rows read as before", () => {
  assert.equal(auditUserName(log({ actor_type: "staff" })), "Ana Reyes");
  assert.equal(auditUserName(log({ user: null as unknown as AuditLog["user"], actor_type: "system" })), "System");
});

test("every Member Portal action and target reads in words", () => {
  for (const action of [
    "portal_code_issued",
    "portal_access_disabled",
    "portal_request_decided",
    "portal_request_hold_placed",
    "portal_announcement_published",
    "portal_document_shared",
    "portal_terms_published",
  ]) {
    assert.ok(!auditActionLabel(action).includes("_"), action);
    assert.notEqual(auditActionLabel(action), action);
  }
  assert.equal(auditTargetType("PortalRequest"), "Portal request");
  assert.equal(auditTargetType("PortalUser"), "Portal account");
  assert.equal(auditTargetType("PortalSetting"), "Member Portal settings");
});

test("a CDA workflow row's action reads in words, never its key (ReportWorkflow::ACTIONS)", () => {
  const cda = { target: { id: 3, type: "CdaReport", label: "Annual report 2026" } };
  const words: Record<string, string> = {
    refresh: "Refreshed",
    validate: "Refreshed",
    submit_for_review: "Submitted for review",
    return: "Returned for changes",
    approve: "Approved",
    finalize: "Finalized",
    mark_submitted: "Filing recorded with CDA",
    mark_accepted: "Marked as accepted",
    mark_for_correction: "Marked for correction",
    reopen: "Reopened",
    set_stage: "Moved to another stage",
    approve_step: "Approved a review step",
  };
  for (const [key, label] of Object.entries(words)) {
    assert.equal(auditChangeValue(cda, "action", key), label, key);
  }
  assert.equal(auditChangePair(cda, { field: "action", old: null, new: "return" }).new, "Returned for changes");
});

test("an action value from another module reads like the Action column, never its key", () => {
  assert.equal(auditChangeValue({ target: null }, "action", "penalty_waived"), "Penalty waived");
  assert.equal(auditChangeValue({ target: null }, "action", "some_new_action"), "Some new action");
});

test("every action the backend writes has its own words", () => {
  const words: Record<string, string> = {
    accounting_opening_balance_created: "Opening balance created",
    accounting_opening_balance_saved: "Opening balance saved",
    accounting_opening_balance_finalised: "Opening balance finalised",
    accounting_opening_balances_posted: "Opening balances posted",
    allowance_posted: "Allowance posted",
    branches_changed: "Branches changed",
    chart_of_accounts_seeded: "Chart of accounts set up",
    password_change_required: "Password change required",
    password_changed: "Password changed",
    penalty_waived: "Penalty waived",
    periods_closed: "Periods closed",
    profile_updated: "Profile updated",
    savings_approval_cancelled: "Request cancelled",
    scorecard_reviewed: "Scorecard reviewed",
  };
  for (const [key, label] of Object.entries(words)) assert.equal(auditActionLabel(key), label, key);
});
