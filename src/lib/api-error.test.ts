import { test } from "node:test";
import assert from "node:assert/strict";
import { getErrorMessage, getFieldErrors, firstFieldError } from "./api-error";

const httpErr = (status: number, data?: unknown) => ({ response: { status, data } });

test("422 surfaces the first field message", () => {
  const err = httpErr(422, {
    message: "Validation failed",
    errors: { email: ["The email has already been taken."] },
  });
  assert.equal(getErrorMessage(err), "The email has already been taken.");
});

test("422 with no field errors uses generic validation copy", () => {
  assert.equal(
    getErrorMessage(httpErr(422, {})),
    "Please review the highlighted details and try again."
  );
});

test("401 maps to session-expired copy", () => {
  assert.equal(getErrorMessage(httpErr(401)), "Your session has expired. Please sign in again.");
});

test("403 maps to permission copy", () => {
  assert.equal(getErrorMessage(httpErr(403)), "You don't have permission to do that.");
});

test("404 maps to not-found copy", () => {
  assert.equal(getErrorMessage(httpErr(404)), "We couldn't find what you were looking for.");
});

test("413 maps to file-too-large copy", () => {
  assert.equal(
    getErrorMessage(httpErr(413)),
    "That file is too large. Please upload a smaller file."
  );
});

test("429 maps to rate-limit copy", () => {
  assert.equal(
    getErrorMessage(httpErr(429)),
    "Too many attempts. Please wait a moment and try again."
  );
});

test("500 maps to server copy, ignoring any raw backend message", () => {
  assert.equal(
    getErrorMessage(httpErr(500, { message: "SQLSTATE[23000]: Integrity constraint" })),
    "Something went wrong on our end. Please try again in a moment."
  );
});

test("no response (offline) maps to connection copy", () => {
  assert.equal(
    getErrorMessage({ message: "Network Error" }),
    "You appear to be offline. Check your connection and try again."
  );
});

test("raw Axios status-code string never leaks even on unknown status", () => {
  assert.equal(
    getErrorMessage(httpErr(418, { message: "Request failed with status code 418" }), "Could not complete that."),
    "Could not complete that."
  );
});

test("internal force=true flag never leaks", () => {
  assert.equal(
    getErrorMessage(httpErr(409, { message: "Pass force=true to override" }), "That conflicts."),
    "That action conflicts with the current state. Refresh and try again."
  );
});

test("a human 400 message is surfaced", () => {
  assert.equal(
    getErrorMessage(httpErr(400, { message: "Amount exceeds the available balance." })),
    "Amount exceeds the available balance."
  );
});

test("getFieldErrors returns all messages flattened", () => {
  const err = httpErr(422, { errors: { a: ["A required"], b: ["B invalid", "B too long"] } });
  assert.deepEqual(getFieldErrors(err), ["A required", "B invalid", "B too long"]);
});

test("firstFieldError returns null when none", () => {
  assert.equal(firstFieldError(httpErr(500, {})), null);
});
