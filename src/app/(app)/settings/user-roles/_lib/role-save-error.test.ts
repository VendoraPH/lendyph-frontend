import { test } from "node:test";
import assert from "node:assert/strict";
import { otherRoleSaveErrors, roleSaveErrorMessage } from "./role-save-error";

function http422(errors: Record<string, string[]>) {
  return { response: { status: 422, data: { message: "The given data was invalid.", errors } } };
}

const sent = ["dashboard:view", "loans:view", "credit_scoring:view"];

// What staging showed: the toast read "The selected permissions.2 is invalid."
test("names the permission the server refused, in plain words", () => {
  const message = roleSaveErrorMessage(
    http422({ "permissions.2": ["The selected permissions.2 is invalid."] }),
    sent
  );
  assert.equal(
    message,
    "This server doesn't offer Credit Scoring: View yet, so nothing was saved. Untick it and save again."
  );
  assert.doesNotMatch(message ?? "", /permissions\.\d/);
});

test("lists every refused permission once", () => {
  const message = roleSaveErrorMessage(
    http422({
      "permissions.0": ["The selected permissions.0 is invalid."],
      "permissions.2": ["The selected permissions.2 is invalid."],
    }),
    sent
  );
  assert.equal(
    message,
    "This server doesn't offer Dashboard: View and Credit Scoring: View yet, so nothing was saved. Untick them and save again."
  );
});

test("leaves every other error to the shared handler", () => {
  assert.equal(roleSaveErrorMessage(http422({ name: ["The name has already been taken."] }), sent), null);
  assert.equal(roleSaveErrorMessage({ response: { status: 500, data: {} } }, sent), null);
  assert.equal(roleSaveErrorMessage(new Error("boom"), sent), null);
});

test("an index the request didn't send is not guessed at", () => {
  assert.equal(
    roleSaveErrorMessage(http422({ "permissions.9": ["The selected permissions.9 is invalid."] }), sent),
    null
  );
});

test("keeps the other field errors of the same refused save", () => {
  const err = http422({
    name: ["The name has already been taken."],
    "permissions.2": ["The selected permissions.2 is invalid."],
  });
  assert.ok(roleSaveErrorMessage(err, sent));
  assert.deepEqual(otherRoleSaveErrors(err), ["The name has already been taken."]);
  assert.deepEqual(otherRoleSaveErrors(http422({ "permissions.2": ["x"] })), []);
  assert.deepEqual(otherRoleSaveErrors({ response: { status: 500, data: {} } }), []);
});
