import { test } from "node:test";
import assert from "node:assert/strict";
import { moneyPostMessage, readMoneyPost } from "./money-post";
import type { SavingsApproval } from "@/types";

const approval = { id: 7, kind: "withdrawal", required_checkers: 1 } as SavingsApproval;

test("a 201 is the posted record", () => {
  const result = readMoneyPost<{ id: number }>(201, { id: 3 });
  assert.deepEqual(result, { kind: "posted", record: { id: 3 } });
  assert.equal(moneyPostMessage(result, "Withdrawal posted."), "Withdrawal posted.");
});

test("a 202 with an approval is sent for approval, never posted", () => {
  const result = readMoneyPost(202, { approval });
  assert.equal(result.kind, "sent_for_approval");
  assert.equal(result.kind === "sent_for_approval" && result.approval.id, 7);
  assert.equal(moneyPostMessage(result, "Withdrawal posted."), "Sent for approval. It posts once another user approves it.");
});

test("above the second tier the message names the number of approvers", () => {
  const result = readMoneyPost(202, { approval: { ...approval, required_checkers: 2 } });
  assert.equal(
    moneyPostMessage(result, "Posted."),
    "Sent for approval. 2 different approvers must approve it before it posts.",
  );
});

test("a 202 without an approval is refused, not shown as posted", () => {
  assert.throws(() => readMoneyPost(202, { id: 3 }));
  assert.throws(() => readMoneyPost(202, null));
  assert.throws(() => readMoneyPost(202, { approval: null }));
});

test("a checker needed for a reason other than the amount says why, in the server's words", () => {
  const check_reason = "This account was reactivated by today's deposit, so a checker must approve money going out today.";
  const result = readMoneyPost(202, { approval: { ...approval, check_reason } });
  assert.equal(moneyPostMessage(result, "Withdrawal posted."), `Sent for approval. ${check_reason}`);
});

test("a blank check reason falls back to the tier wording", () => {
  const result = readMoneyPost(202, { approval: { ...approval, check_reason: " " } });
  assert.equal(moneyPostMessage(result, "Posted."), "Sent for approval. It posts once another user approves it.");
});
