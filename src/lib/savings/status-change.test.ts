import { test } from "node:test";
import assert from "node:assert/strict";
import { REACTIVATION_SENT_TEXT, readStatusChange } from "./status-change";

const approval = { id: 41, kind: "reactivation", status: "pending", amount: "0.00", required_checkers: 1 };

test("a 200 is the changed account (freeze, unfreeze)", () => {
  const result = readStatusChange(200, { success: true, data: { id: 5, status: "frozen" } });
  assert.equal(result.kind, "changed");
  assert.equal(result.kind === "changed" && result.account.status, "frozen");
});

test("a 202 reactivation is sent for approval with the server's sentence; the account isn't changed", () => {
  const message = "Reactivation sent for approval. The account stays dormant until a checker approves it.";
  const result = readStatusChange(202, { success: true, message, data: { approval } });
  assert.deepEqual(result, { kind: "sent_for_approval", approval, message });
});

test("a 202 without a message keeps the approval; the screen uses its own sentence", () => {
  const result = readStatusChange(202, { success: true, data: { approval } });
  assert.equal(result.kind === "sent_for_approval" && result.message, null);
  assert.match(REACTIVATION_SENT_TEXT, /stays dormant until a checker approves it/);
});

test("a 202 without an approval is refused, never read as changed", () => {
  assert.throws(() => readStatusChange(202, { success: true, data: { id: 5, status: "active" } }));
  assert.throws(() => readStatusChange(202, null));
});
