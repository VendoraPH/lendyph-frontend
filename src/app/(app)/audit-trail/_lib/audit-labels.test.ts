import { test } from "node:test";
import assert from "node:assert/strict";
import type { AuditLog } from "@/types";
import {
  AUDIT_MODULE_OPTIONS,
  auditActionLabel,
  auditDescription,
  auditFieldLabel,
  auditModuleLabel,
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

test("accounting and GCash rows read by their module names", () => {
  assert.equal(auditModuleLabel(log({ module: "accounting", target: null })), "Accounting");
  assert.equal(auditModuleLabel(log({ module: "gcash", target: null })), "GCash");
});

test("the module filter offers exactly the modules the server filters by", () => {
  assert.deepEqual(
    AUDIT_MODULE_OPTIONS.map((o) => o.value).sort(),
    ["accounting", "auth", "borrowers", "collections", "gcash", "loans", "payments", "roles", "system", "users"]
  );
  assert.ok(AUDIT_MODULE_OPTIONS.every((o) => o.label === auditModuleLabel({ module: o.value, target: null })));
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
