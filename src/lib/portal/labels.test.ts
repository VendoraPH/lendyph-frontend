import { test } from "node:test";
import assert from "node:assert/strict";
import { accountActions, humanize, membershipTone } from "./labels";

test("humanize reads an unknown server value", () => {
  assert.equal(humanize("under_review"), "Under review");
  assert.equal(humanize(""), "");
});

test("membershipTone", () => {
  assert.equal(membershipTone("active"), "success");
  assert.equal(membershipTone("deceased"), "danger");
  assert.equal(membershipTone("pending"), "warning");
});

test("accountActions offers only the moves the status allows", () => {
  assert.deepEqual(accountActions("not_invited"), { invite: true, resend: false, unlock: false, disable: false, enable: false });
  assert.equal(accountActions("invitation_sent").resend, true);
  assert.equal(accountActions("locked").unlock, true);
  assert.equal(accountActions("locked").disable, true);
  assert.deepEqual(accountActions("disabled"), { invite: false, resend: false, unlock: false, disable: false, enable: true });
});
