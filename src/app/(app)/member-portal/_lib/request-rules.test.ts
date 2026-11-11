import { test } from "node:test";
import assert from "node:assert/strict";
import { decisionBody, decisionOutcome, decisionProblems, decisionsFor, needsMessage, type DecisionForm } from "./request-rules";

const form = (over: Partial<DecisionForm> = {}): DecisionForm => ({
  decision: "approve",
  message: "",
  money: { date: "2026-11-11", method: "cash", reference: "" },
  ...over,
});

test("decisions follow the request's status, as the server allows them", () => {
  assert.deepEqual(decisionsFor("submitted"), ["under_review", "need_info", "approve", "reject"]);
  assert.deepEqual(decisionsFor("under_review"), ["need_info", "approve", "reject"]);
  assert.deepEqual(decisionsFor("need_info"), ["under_review", "approve", "reject"]);
  for (const done of ["approved", "completed", "rejected", "cancelled", "expired"] as const) {
    assert.deepEqual(decisionsFor(done), [], done);
  }
});

test("asking for information and rejecting need a message", () => {
  assert.equal(needsMessage("need_info"), true);
  assert.equal(needsMessage("reject"), true);
  assert.equal(needsMessage("approve"), false);
  assert.deepEqual(decisionProblems("profile_update", form({ decision: "reject" })), [
    "Write a message to the member: it is shown on their request.",
  ]);
});

test("approving a withdrawal needs the payout date and method", () => {
  const problems = decisionProblems("savings_withdrawal", form({ money: { date: "", method: "", reference: "" } }));
  assert.deepEqual(problems, ["Enter the payout date.", "Choose how the money was paid out."]);
});

test("a withdrawal approval sends the payout and never an amount", () => {
  const body = decisionBody("savings_withdrawal", form({ money: { date: "2026-11-11", method: "bank_transfer", reference: " TX-1 " } }));
  assert.deepEqual(body, { decision: "approve", payout: { date: "2026-11-11", method: "bank_transfer", reference: "TX-1" } });
  assert.equal("amount" in body, false);
});

test("a new account approval sends the deposit; a profile approval sends neither", () => {
  assert.deepEqual(decisionBody("savings_opening", form({ money: { date: "2026-11-11", method: "", reference: "" } })), {
    decision: "approve",
    deposit: { date: "2026-11-11" },
  });
  assert.deepEqual(decisionBody("profile_update", form()), { decision: "approve" });
});

test("only an approval carries money details", () => {
  assert.deepEqual(decisionBody("savings_withdrawal", form({ decision: "reject", message: " Not enough ID " })), {
    decision: "reject",
    message: "Not enough ID",
  });
});

test("a 202 says it waits for a second approval; a 201 that it posted", () => {
  assert.match(decisionOutcome("savings_withdrawal", "approve", 202), /^Waiting for a second approval/);
  assert.equal(decisionOutcome("savings_withdrawal", "approve", 201), "Withdrawal approved and posted.");
  assert.equal(decisionOutcome("savings_opening", "approve", 201), "Savings account opened.");
  assert.match(decisionOutcome("savings_withdrawal", "reject", 200), /held money was released/);
});

test("approving a withdrawal sends the message to the member too", () => {
  const body = decisionBody("savings_withdrawal", form({ message: " Ready at the counter tomorrow. " }));
  assert.equal(body.message, "Ready at the counter tomorrow.");
  assert.deepEqual(decisionBody("profile_update", form({ message: "Saved." })), { decision: "approve", message: "Saved." });
});
