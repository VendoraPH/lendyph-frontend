import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reloadAfterFailure,
  decisionBody,
  decisionOutcome,
  decisionProblems,
  decisionReferenceNeeded,
  decisionReferenceProblem,
  decisionReferenceRefusal,
  decisionsFor,
  needsMessage,
  type DecisionForm,
} from "./request-rules";

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

test("a new account with an opening deposit needs the deposit's method; one with nothing to deposit doesn't", () => {
  const noMethod = form({ money: { date: "2026-11-11", method: "", reference: "" } });
  assert.deepEqual(decisionProblems("savings_opening", noMethod, "500.00"), ["Choose how the opening deposit was paid."]);
  assert.deepEqual(decisionProblems("savings_opening", noMethod, "0.00"), []);
  assert.deepEqual(decisionProblems("savings_opening", noMethod, null), []);
  assert.deepEqual(decisionProblems("savings_opening", form(), "500.00"), []);
});

test("a 409 reloads the request, so its status and buttons are current", () => {
  assert.equal(reloadAfterFailure({ response: { status: 409, data: {} } }), true);
  assert.equal(reloadAfterFailure({ response: { status: 422, data: {} } }), false);
  assert.equal(reloadAfterFailure(new Error("offline")), false);
});

test("a payout by bank transfer, GCash or Maya needs its reference, in the server's words; cash doesn't", () => {
  const gcash = form({ money: { date: "2026-11-11", method: "gcash", reference: " " } });
  assert.equal(decisionReferenceNeeded("savings_withdrawal", gcash), true);
  assert.equal(decisionReferenceProblem("savings_withdrawal", gcash), "Enter the GCash reference for this payout.");
  assert.equal(
    decisionReferenceProblem("savings_withdrawal", form({ money: { date: "2026-11-11", method: "bank_transfer", reference: "" } })),
    "Enter the bank transfer reference for this payout.",
  );
  assert.equal(decisionReferenceProblem("savings_withdrawal", form({ money: { date: "2026-11-11", method: "maya", reference: "MY-1" } })), null);
  assert.equal(decisionReferenceNeeded("savings_withdrawal", form()), false);
  assert.equal(decisionReferenceProblem("savings_withdrawal", form()), null);
  // The other problems stay as they were: the reference has its own check, on its field.
  assert.deepEqual(decisionProblems("savings_withdrawal", gcash), []);
});

test("a new account's non-cash opening deposit needs its reference; nothing to deposit, or another decision, needs none", () => {
  const maya = form({ money: { date: "2026-11-11", method: "maya", reference: "" } });
  assert.equal(decisionReferenceProblem("savings_opening", maya, "500.00"), "Enter the Maya reference for the opening deposit.");
  assert.equal(decisionReferenceNeeded("savings_opening", maya, "0.00"), false);
  assert.equal(decisionReferenceProblem("savings_opening", maya, "0.00"), null);
  assert.equal(decisionReferenceProblem("savings_withdrawal", form({ decision: "reject", money: maya.money })), null);
  assert.equal(decisionReferenceNeeded("profile_update", maya), false);
});

test("the server's refusal of the reference shows on the field, from the approval's own key or the teller's", () => {
  const refused = (key: string, message: string) => ({ response: { status: 422, data: { message, errors: { [key]: [message] } } } });
  const missing = "Enter the GCash reference for this payout.";
  const taken = 'Reference "GC-1" is already on record for another GCash transaction. Check the reference and enter the right one.';
  assert.equal(decisionReferenceRefusal("savings_withdrawal", refused("payout.reference", missing)), missing);
  assert.equal(decisionReferenceRefusal("savings_withdrawal", refused("reference", taken)), taken);
  assert.equal(
    decisionReferenceRefusal("savings_opening", refused("deposit.reference", "Enter the GCash reference for the opening deposit.")),
    "Enter the GCash reference for the opening deposit.",
  );
  assert.equal(decisionReferenceRefusal("savings_withdrawal", refused("payout.date", "Enter the payout date.")), null);
  assert.equal(decisionReferenceRefusal("savings_withdrawal", { response: { status: 409, data: {} } }), null);
});
