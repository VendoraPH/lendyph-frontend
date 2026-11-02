import { test } from "node:test";
import assert from "node:assert/strict";
import type { AuditLog } from "@/types";
import { auditActionLabel, auditDescription, auditModuleLabel, auditUserName } from "./audit-labels";

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
