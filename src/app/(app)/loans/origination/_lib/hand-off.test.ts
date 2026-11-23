import { test } from "node:test";
import assert from "node:assert/strict";
import { canCreateAnyway, handOffBlocker, handOffPayload, handOffRefusal } from "./hand-off";
import type { Permission } from "@/types";

const can = (held: Permission[]) => (p: Permission) => held.includes(p);
const httpError = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });

test("the hand-off sends the version read, and the start date only when staff chose one", () => {
  assert.deepEqual(handOffPayload(4, { startDate: "", forceNewMember: false }), { version: 4 });
  assert.deepEqual(handOffPayload(4, { startDate: "2026-12-01", forceNewMember: false }), { version: 4, start_date: "2026-12-01" });
  assert.deepEqual(handOffPayload(0, { startDate: "", forceNewMember: true }), { version: 0, force_new_member: true });
});

test("Submit for approval needs convert and loans:create, plus borrowers:create to create the member", () => {
  const handOff: Permission[] = ["loan_origination:convert", "loans:create"];
  assert.equal(handOffBlocker(can(handOff), false), null);
  assert.equal(handOffBlocker(can([...handOff, "borrowers:create"]), true), null);
  assert.equal(
    handOffBlocker(can(handOff), true),
    "Handing this application off creates its member, which needs the permission to create members.",
  );
  for (const held of [["loan_origination:convert"], ["loans:create"], []] as Permission[][]) {
    assert.equal(
      handOffBlocker(can(held), false),
      "Moving an application to For Approval needs the permission to hand applications off and the permission to create loans.",
    );
  }
});

test("a refusal shows the server's words, every one of them", () => {
  const refusal = handOffRefusal(
    httpError(422, {
      message: "The application changed after it was assessed. Run the assessment again. (and 1 more error)",
      errors: {
        assessment: ["The application changed after it was assessed. Run the assessment again."],
        documents: ["Verify these documents first: Payslip."],
      },
    }),
  );
  assert.deepEqual(refusal.messages, [
    "The application changed after it was assessed. Run the assessment again.",
    "Verify these documents first: Payslip.",
  ]);
  assert.equal(refusal.duplicateMember, false);
  assert.equal(refusal.loanId, null);
});

test("the duplicate-member refusal is recognised, so Create anyway can be offered", () => {
  const refusal = handOffRefusal(
    httpError(422, {
      message: "The applicant matches Ana Cruz (BRW-000012), already a member. Link that member to the application, or create a new member anyway.",
      errors: {
        member: ["The applicant matches Ana Cruz (BRW-000012), already a member. Link that member to the application, or create a new member anyway."],
      },
    }),
  );
  assert.equal(refusal.duplicateMember, true);
  assert.deepEqual(refusal.messages, [
    "The applicant matches Ana Cruz (BRW-000012), already a member. Link that member to the application, or create a new member anyway.",
  ]);
});

test("Create anyway is offered only to borrowers:create holders, for an application that creates its member", () => {
  const duplicate = { messages: ["…"], duplicateMember: true, loanId: null, stale: false };
  assert.equal(canCreateAnyway(duplicate, can(["borrowers:create"]), null), true);
  assert.equal(canCreateAnyway(duplicate, can([]), null), false);
  assert.equal(canCreateAnyway(duplicate, can(["borrowers:create"]), 9), false);
  assert.equal(canCreateAnyway({ ...duplicate, duplicateMember: false }, can(["borrowers:create"]), null), false);
});

test("a repeat answers 409 naming the loan, so the page can open it", () => {
  const refusal = handOffRefusal(httpError(409, { message: "This application was already handed off as loan LA-000031.", loan_id: 31 }));
  assert.deepEqual(refusal.messages, ["This application was already handed off as loan LA-000031."]);
  assert.equal(refusal.loanId, 31);
  assert.equal(refusal.stale, true);
});

test("a changed application answers 409 too, and the page reloads it", () => {
  const refusal = handOffRefusal(
    httpError(409, { message: "This application changed while you were working on it. Refresh to see its current status." }),
  );
  assert.equal(refusal.stale, true);
  assert.equal(refusal.loanId, null);
  assert.deepEqual(refusal.messages, ["This application changed while you were working on it. Refresh to see its current status."]);
});

test("a permission refusal keeps the server's words", () => {
  const refusal = handOffRefusal(
    httpError(403, { message: "Handing this application off creates its member, which needs the permission to create members." }),
  );
  assert.deepEqual(refusal.messages, ["Handing this application off creates its member, which needs the permission to create members."]);
});

test("a failure with no server words still says what failed", () => {
  assert.deepEqual(handOffRefusal(new Error("boom")).messages, ["Could not submit the application for approval."]);
});
