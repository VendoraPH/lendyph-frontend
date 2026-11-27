import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldErrorsOf, portalErrorMessage } from "./errors";
import { NotConfirmedError } from "./server-confirm";

const http = (status: number, data: unknown) => ({ response: { status, data } });

test("a 422 lands beside its field, the details. prefix taken off", () => {
  const err = http(422, { errors: { "details.amount": ["The amount is more than you can withdraw now."], remarks: ["Too long."] } });
  assert.deepEqual(fieldErrorsOf(err), { amount: "The amount is more than you can withdraw now.", remarks: "Too long." });
  assert.deepEqual(fieldErrorsOf(new Error("x")), {});
});

test("known refusals read in the portal's words", () => {
  assert.equal(portalErrorMessage(http(403, { code: "feature_off", message: "x" }), "f"), "This part of the portal is turned off by your cooperative.");
  assert.match(portalErrorMessage(http(404, { message: "No query results for model [App\\Models\\Loan] 4" }), "f"), /isn't yours/);
  assert.match(portalErrorMessage(new NotConfirmedError(204), "f"), /couldn't confirm/);
});

test("the server's own sentence wins on a 409", () => {
  const err = http(409, { message: "You already have an open withdrawal request on this account." });
  assert.equal(portalErrorMessage(err, "fallback"), "You already have an open withdrawal request on this account.");
});

test("a wrong password on sign-in reads the server's words, not the staff session wording", () => {
  const err = http(401, { message: "The member number or password is incorrect." });
  assert.equal(portalErrorMessage(err, "We couldn't sign you in."), "The member number or password is incorrect.");
});

test("each code step and the password change read the server's 422 words", () => {
  const verify = http(422, { message: "x", errors: { code: ["The member number, code or birthdate doesn't match."] } });
  assert.equal(portalErrorMessage(verify, "f"), "The member number, code or birthdate doesn't match.");
  const complete = http(422, { errors: { password: ["The password can't contain your member number."] } });
  assert.equal(portalErrorMessage(complete, "f"), "The password can't contain your member number.");
  const change = http(422, { errors: { current_password: ["Your current password is incorrect."] } });
  assert.equal(portalErrorMessage(change, "f"), "Your current password is incorrect.");
  const disabled = http(403, { message: "Your portal access is turned off. Please contact your branch.", code: "portal_access_disabled" });
  assert.equal(portalErrorMessage(disabled, "f"), "Your portal access is turned off. Please contact your branch.");
});

test("a bare 401 (a signed-in page whose session ended) keeps the session wording", () => {
  assert.equal(portalErrorMessage(http(401, { message: "Unauthenticated." }), "f"), "Your session has ended. Please sign in again.");
  assert.equal(portalErrorMessage(http(401, {}), "f"), "Your session has ended. Please sign in again.");
});

test("the shared toast shows a finished portal message as it is", async () => {
  const { getErrorMessage } = await import("@/lib/api-error");
  const words = portalErrorMessage(http(401, { message: "The member number or password is incorrect." }), "f");
  assert.equal(getErrorMessage(null, words), "The member number or password is incorrect.");
});
