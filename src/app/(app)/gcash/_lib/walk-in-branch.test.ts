import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { NO_BRANCH } from "@/lib/branch-choice";
import {
  HEAD_OFFICE_LABEL,
  NO_BRANCH_EXPLANATION,
  PICK_BRANCH,
  branchRefusal,
  gcashBranchLabel,
  gcashRowBranchLabel,
  gcashSaveFailure,
  walkInBranchBlocked,
  walkInBranchChoice,
  walkInBranchPayload,
} from "./walk-in-branch";

/** The server's own words (StoreGCashTransactionRequest) for a caller with no branch. */
const SERVER_NO_BRANCH =
  "You have no branch assigned, so you cannot record a walk-in transaction. Ask an administrator to assign you a branch.";

const main = { id: 1, name: "Main" };
const north = { id: 2, name: "North" };
const south = { id: 3, name: "South" };
const listed = [main, north, south];

describe("the walk-in Cash In / Cash Out branch", () => {
  test("one branch: shown, never picked, and no branch_id is sent", () => {
    const choice = walkInBranchChoice("non_member", { viewAll: false, own: [north], listed });
    assert.deepEqual(choice, { kind: "fixed", branch: north });
    assert.deepEqual(walkInBranchPayload(choice, null), { ok: true, body: {} });
  });

  test("several branches: one of theirs must be picked, with no head office option", () => {
    const choice = walkInBranchChoice("non_member", { viewAll: false, own: [north, south], listed });
    assert.deepEqual(choice, {
      kind: "pick",
      items: [
        { value: "2", label: "North" },
        { value: "3", label: "South" },
      ],
      preselected: null,
    });
    assert.deepEqual(walkInBranchPayload(choice, null), { ok: false, message: PICK_BRANCH });
    assert.deepEqual(walkInBranchPayload(choice, "3"), { ok: true, body: { branch_id: 3 } });
  });

  test("view_all with one assigned branch: any branch or head office, their own preselected", () => {
    const choice = walkInBranchChoice("non_member", { viewAll: true, own: [north], listed });
    assert.deepEqual(choice, {
      kind: "pick",
      items: [
        { value: NO_BRANCH, label: HEAD_OFFICE_LABEL },
        { value: "1", label: "Main" },
        { value: "2", label: "North" },
        { value: "3", label: "South" },
      ],
      preselected: "2",
    });
    assert.equal(HEAD_OFFICE_LABEL, "None (head office)");
  });

  test("view_all with no or several assigned branches: nothing preselected, so it must be picked", () => {
    for (const own of [[], [main, south]]) {
      const choice = walkInBranchChoice("non_member", { viewAll: true, own, listed });
      assert.equal(choice.kind === "pick" && choice.preselected, null);
      assert.deepEqual(walkInBranchPayload(choice, null), { ok: false, message: PICK_BRANCH });
    }
  });

  test("view_all picking head office sends branch_id: null explicitly", () => {
    const choice = walkInBranchChoice("non_member", { viewAll: true, own: [], listed });
    const payload = walkInBranchPayload(choice, NO_BRANCH);
    assert.deepEqual(payload, { ok: true, body: { branch_id: null } });
    assert.ok(payload.ok && "branch_id" in payload.body);
  });

  test("no branch and no view_all: explained, and sent without a key so the server's 422 words show", () => {
    const choice = walkInBranchChoice("non_member", { viewAll: false, own: [], listed: [] });
    assert.deepEqual(choice, { kind: "unassigned" });
    assert.deepEqual(walkInBranchPayload(choice, null), { ok: true, body: {} });
    assert.match(NO_BRANCH_EXPLANATION, /no branch assigned/);
  });

  test("no branch and no view_all: Record is disabled, and the reason is the server's words", () => {
    const choice = walkInBranchChoice("non_member", { viewAll: false, own: [], listed: [] });
    assert.equal(walkInBranchBlocked(choice), true);
    assert.equal(NO_BRANCH_EXPLANATION, SERVER_NO_BRANCH);
  });

  test("every other caller, and every member's transaction, can record", () => {
    for (const source of [
      { viewAll: false, own: [north], listed },
      { viewAll: false, own: [north, south], listed },
      { viewAll: true, own: [], listed },
    ]) {
      assert.equal(walkInBranchBlocked(walkInBranchChoice("non_member", source)), false);
    }
    assert.equal(walkInBranchBlocked(walkInBranchChoice("member", { viewAll: false, own: [], listed: [] })), false);
  });

  test("a member's transaction has no picker and sends no branch_id, whoever records it", () => {
    for (const source of [
      { viewAll: true, own: [north], listed },
      { viewAll: false, own: [north, south], listed },
      { viewAll: false, own: [], listed: [] },
    ]) {
      const choice = walkInBranchChoice("member", source);
      assert.deepEqual(choice, { kind: "member" });
      assert.deepEqual(walkInBranchPayload(choice, "2"), { ok: true, body: {} });
    }
  });
});

describe("a GCash row's branch in words", () => {
  test("its name when set, a stand-in for a branch the caller can't list, nothing when unset", () => {
    assert.equal(gcashBranchLabel(2, listed), "North");
    assert.equal(gcashBranchLabel(9, listed), "Another branch");
    assert.equal(gcashBranchLabel(null, listed), null);
    assert.equal(gcashBranchLabel(undefined, listed), null);
  });
});

describe("a GCash row's branch on the lists", () => {
  test("a member's row posts in the member's branch, so it says so instead of a dash", () => {
    assert.equal(gcashRowBranchLabel({ borrower: { id: 4 }, branch_id: null }, listed), "Member's branch");
    assert.equal(gcashRowBranchLabel({ borrower: { id: 4 } }, listed), "Member's branch");
  });

  test("a walk-in row with no branch is head office's", () => {
    assert.equal(gcashRowBranchLabel({ non_member: { id: 5 }, branch_id: null }, listed), "Head office");
  });

  test("a walk-in row with a branch reads its name, or a stand-in for one the caller can't list", () => {
    assert.equal(gcashRowBranchLabel({ non_member: { id: 5 }, branch_id: 2 }, listed), "North");
    assert.equal(gcashRowBranchLabel({ non_member: { id: 5 }, branch_id: 9 }, listed), "Another branch");
  });

  test("the pending report's branch_name never names a branch the user can't list: both tabs read alike", () => {
    // A Main-branch teller: the report sends "P3FU North Branch"; the
    // Transactions tab says "Another branch" for the same transaction.
    const own = [main];
    const walkIn = { non_member: { id: 5 }, branch_id: 2 };
    assert.equal(gcashRowBranchLabel({ ...walkIn, branch_name: "P3FU North Branch" }, own), "Another branch");
    assert.equal(gcashRowBranchLabel({ ...walkIn, branch_name: "P3FU North Branch" }, own), gcashRowBranchLabel(walkIn, own));
    assert.equal(gcashRowBranchLabel({ non_member: { id: 5 }, branch_id: 1, branch_name: "Main" }, own), "Main");
    assert.equal(gcashRowBranchLabel({ non_member: { id: 5 }, branch_id: null, branch_name: "Head office" }, own), "Head office");
    // A member's row reads the member's branch on both tabs, whatever the report names.
    assert.equal(gcashRowBranchLabel({ borrower: { id: 4 }, branch_id: 2, branch_name: "P3FU North Branch" }, own), "Member's branch");
  });

  test("an older answer that leaves the branch out entirely shows a dash for a walk-in", () => {
    assert.equal(gcashRowBranchLabel({ non_member: { id: 5 } }, listed), "—");
    assert.equal(gcashRowBranchLabel({ non_member: { id: 5 }, branch_name: "" }, listed), "—");
    assert.equal(gcashRowBranchLabel({ non_member: { id: 5 }, branch_name: "East" }, listed), "—");
  });
});

describe("where a refused save is shown", () => {
  test("a refusal of the branch shows once, beside the field, and not as a toast too", () => {
    const err = { response: { status: 422, data: { message: SERVER_NO_BRANCH, errors: { branch_id: [SERVER_NO_BRANCH] } } } };
    assert.deepEqual(gcashSaveFailure(err), { field: SERVER_NO_BRANCH, toast: null });
  });

  test("any other refusal is a toast only", () => {
    const err = { response: { status: 422, data: { message: "Too much.", errors: { amount: ["Too much."] } } } };
    const failure = gcashSaveFailure(err);
    assert.equal(failure.field, null);
    assert.equal(typeof failure.toast, "string");
    assert.ok(failure.toast && failure.toast.length > 0);
  });
});

describe("the server's refusal of the branch", () => {
  test("a 422 on branch_id reads in the server's words; anything else is left to the toast", () => {
    const words = "You have no branch assigned, so you cannot record a walk-in transaction. Ask an administrator to assign you a branch.";
    assert.equal(branchRefusal({ response: { status: 422, data: { errors: { branch_id: [words] } } } }), words);
    assert.equal(branchRefusal({ response: { status: 422, data: { errors: { amount: ["Too much."] } } } }), null);
    assert.equal(branchRefusal({ response: { status: 409, data: { message: "Duplicate." } } }), null);
    assert.equal(branchRefusal(new Error("boom")), null);
  });
});
