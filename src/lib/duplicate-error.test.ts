import { test } from "node:test";
import assert from "node:assert/strict";
import { isDuplicateNameMessage, isAlreadyRegisteredError } from "./duplicate-error";

const httpErr = (status: number, data?: unknown) => ({ response: { status, data } });

const DUP_RAW =
  "A similar borrower already exists: Juan Dela Cruz (BRW-000123, born 1990-01-15). Pass force=true to create anyway.";

test("isDuplicateNameMessage matches the backend duplicate copy", () => {
  assert.equal(isDuplicateNameMessage(DUP_RAW), true);
  assert.equal(isDuplicateNameMessage("A similar borrower was found"), true);
  assert.equal(isDuplicateNameMessage("Pass force=true to create anyway."), true);
});

test("isDuplicateNameMessage ignores unrelated / empty messages", () => {
  assert.equal(isDuplicateNameMessage("The birthdate field is required."), false);
  assert.equal(isDuplicateNameMessage(""), false);
  assert.equal(isDuplicateNameMessage(null), false);
  assert.equal(isDuplicateNameMessage(undefined), false);
});

test("isAlreadyRegisteredError detects a name+birthdate duplicate 422", () => {
  const err = httpErr(422, { errors: { first_name: [DUP_RAW] } });
  assert.equal(isAlreadyRegisteredError(err), true);
});

test("isAlreadyRegisteredError detects a unique-email collision 422", () => {
  const err = httpErr(422, { errors: { email: ["The email has already been taken."] } });
  assert.equal(isAlreadyRegisteredError(err), true);
});

test("isAlreadyRegisteredError is false for ordinary validation errors", () => {
  const err = httpErr(422, {
    errors: { contact_number: ["The contact number format is invalid."] },
  });
  assert.equal(isAlreadyRegisteredError(err), false);
});

test("isAlreadyRegisteredError is false for non-422 / network errors", () => {
  assert.equal(isAlreadyRegisteredError(new Error("Network Error")), false);
  assert.equal(isAlreadyRegisteredError(httpErr(500, {})), false);
});
