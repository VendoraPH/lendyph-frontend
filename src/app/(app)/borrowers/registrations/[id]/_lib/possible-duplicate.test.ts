import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acknowledgedApprovalPayload,
  approvalEmailRefusal,
  duplicateConfirmationText,
  needsDuplicateConfirmation,
  possibleDuplicateHref,
  possibleDuplicateLabel,
  possibleDuplicateRefusal,
  type PossibleDuplicate,
} from "./possible-duplicate";

const MEMBER: PossibleDuplicate = {
  visible: true,
  id: 42,
  borrower_code: "BRW-000042",
  full_name: "Juan Dela Cruz",
  is_member: true,
  reason: "Same full name",
  message: "Possible duplicate of BRW-000042 (Juan Dela Cruz): same full name.",
};

const REGISTRATION: PossibleDuplicate = { ...MEMBER, id: 51, borrower_code: "BRW-000051", is_member: false };

const HIDDEN: PossibleDuplicate = {
  visible: false,
  message:
    "This registration may be a duplicate of someone already on file outside your branches. Check with head office before approving.",
};

function refusal(errors: Record<string, unknown>, status = 422): unknown {
  return { response: { status, data: { message: "x", errors } } };
}

test("the link opens the member, or the other registration's review when it isn't a member yet", () => {
  assert.equal(possibleDuplicateHref(MEMBER), "/borrowers/42");
  assert.equal(possibleDuplicateHref(REGISTRATION), "/borrowers/registrations/51");
});

test("the link reads as the member code and name", () => {
  assert.equal(possibleDuplicateLabel(MEMBER), "BRW-000042 (Juan Dela Cruz)");
});

// Approving a registration the server linked to a possible duplicate is
// refused until the reviewer confirms, whether or not they may see who it is.
test("only a registration with a possible duplicate asks for a confirmation", () => {
  assert.equal(needsDuplicateConfirmation({ possible_duplicate: MEMBER }), true);
  assert.equal(needsDuplicateConfirmation({ possible_duplicate: HIDDEN }), true);
  assert.equal(needsDuplicateConfirmation({ possible_duplicate: null }), false);
  assert.equal(needsDuplicateConfirmation({}), false);
});

test("the confirmation names the match only when the server did", () => {
  assert.equal(
    duplicateConfirmationText(MEMBER),
    "Possible duplicate of BRW-000042 (Juan Dela Cruz): same full name. Approve this registration as a new member only once you've checked that it's a different person.",
  );
  assert.equal(duplicateConfirmationText(HIDDEN), HIDDEN.message);
});

test("a refusal from the server is asked in the server's own words", () => {
  const words = "This registration may be a duplicate of BRW-000042 (Juan Dela Cruz). Check that this is a different person, then confirm to approve it.";

  assert.equal(duplicateConfirmationText(MEMBER, words), words);
  assert.equal(duplicateConfirmationText(null, words), words);
});

test("the confirmed approval keeps the branch and adds the confirmation", () => {
  assert.deepEqual(acknowledgedApprovalPayload({ branch_id: 3 }), { branch_id: 3, acknowledge_possible_duplicate: true });
  assert.deepEqual(acknowledgedApprovalPayload({}), { acknowledge_possible_duplicate: true });
});

test("only a 422 on the possible duplicate reads as the server asking for the confirmation", () => {
  assert.equal(possibleDuplicateRefusal(refusal({ possible_duplicate: ["Check it."] })), "Check it.");
  assert.equal(possibleDuplicateRefusal(refusal({ valid_id: ["Upload one."] })), null);
  assert.equal(possibleDuplicateRefusal(refusal({ possible_duplicate: ["Check it."] }, 500)), null);
  assert.equal(possibleDuplicateRefusal(new Error("network")), null);
  assert.equal(possibleDuplicateRefusal(null), null);
});

// The server holds an approval while the registration's email is on another
// member, whatever was confirmed; the page shows its words until the next try.
test("only a 422 on the email reads as the email being on file", () => {
  const words =
    "This email is already on file for another member. Change or clear it in Edit Details before approving.";

  assert.equal(approvalEmailRefusal(refusal({ email: [words] })), words);
  assert.equal(approvalEmailRefusal(refusal({ possible_duplicate: ["Check it."] })), null);
  assert.equal(approvalEmailRefusal(refusal({ email: [words] }, 409)), null);
  assert.equal(approvalEmailRefusal(null), null);
});

test("an email match reads its reason in the server's words", () => {
  const byEmail: PossibleDuplicate = { ...MEMBER, reason: "Same email", message: "Possible duplicate of BRW-000042 (Juan Dela Cruz): same email." };

  assert.equal(
    duplicateConfirmationText(byEmail),
    "Possible duplicate of BRW-000042 (Juan Dela Cruz): same email. Approve this registration as a new member only once you've checked that it's a different person.",
  );
});
