import { test } from "node:test";
import assert from "node:assert/strict";
import { otherRoleSaveErrors, readablePermissionKeys, roleSaveErrorMessage } from "./role-save-error";

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

// What staging showed: "You can't grant permissions you do not hold yourself (loans:approve)."
test("the server's refusal names the permissions it lists in plain words", () => {
  assert.equal(
    readablePermissionKeys("You can't grant permissions you do not hold yourself (loans:approve)."),
    "You can't grant permissions you do not hold yourself (Loans: Approve)."
  );
  assert.equal(
    readablePermissionKeys(
      "You can't grant permissions you do not hold yourself (credit_scoring:view, loans:approve, users:delete, …)."
    ),
    "You can't grant permissions you do not hold yourself (Credit Scoring: View, Loans: Approve, Users: Delete, …)."
  );
});

test("the refused permissions read as the matrix labels them", () => {
  const matrix = (p: string) => (p === "credit_scoring:settings" ? "Credit Scoring: Configure" : p);
  assert.equal(
    readablePermissionKeys("You can't grant permissions you do not hold yourself (credit_scoring:settings).", matrix),
    "You can't grant permissions you do not hold yourself (Credit Scoring: Configure)."
  );
});

test("a message without a permission list is left as it is", () => {
  assert.equal(readablePermissionKeys("The name has already been taken."), "The name has already been taken.");
  assert.equal(
    readablePermissionKeys("We couldn't update the role (try again later)."),
    "We couldn't update the role (try again later)."
  );
});
