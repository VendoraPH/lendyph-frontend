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

test("429 with no body maps to rate-limit copy", () => {
  assert.equal(
    getErrorMessage(httpErr(429)),
    "Too many attempts. Please wait a moment and try again."
  );
});

// The no-body case above is why the friendly 429 copy went unnoticed as dead
// code: in production the throttler DOES send a body, and Laravel's stock
// "Too Many Attempts." is short, plain English that the leak guard let through,
// so the framework string reached the toast instead.
test("429 replaces Laravel's stock 'Too Many Attempts.' with the friendly copy", () => {
  assert.equal(
    getErrorMessage(httpErr(429, { message: "Too Many Attempts." })),
    "Too many attempts. Please wait a moment and try again."
  );
});

test("429 still shows a human backend explanation verbatim", () => {
  const err = httpErr(429, {
    message: "Too many registration attempts. Please try again in 5 minutes.",
  });
  assert.equal(
    getErrorMessage(err),
    "Too many registration attempts. Please try again in 5 minutes."
  );
});

test("the boilerplate guard is anchored — real prose containing 'forbidden' survives", () => {
  const err = httpErr(403, {
    message: "Editing is forbidden while this loan is under review.",
  });
  assert.equal(getErrorMessage(err), "Editing is forbidden while this loan is under review.");
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

// A timeout also arrives with no `response`, but the advice is the opposite of
// offline: the request DID leave the device and may have been processed. Telling
// someone mid-upload they are offline is what produced duplicate registrations.
test("an axios timeout warns the submission may have gone through", () => {
  assert.equal(
    getErrorMessage({ code: "ECONNABORTED", message: "timeout of 30000ms exceeded" }),
    "That took longer than expected, and your submission may still have gone through. Please wait a moment and check before trying again."
  );
});

test("a connect timeout (ETIMEDOUT) gets the same warning", () => {
  assert.equal(
    getErrorMessage({ code: "ETIMEDOUT", message: "connect ETIMEDOUT" }),
    "That took longer than expected, and your submission may still have gone through. Please wait a moment and check before trying again."
  );
});

test("a non-timeout code with no response is still offline", () => {
  assert.equal(
    getErrorMessage({ code: "ERR_NETWORK", message: "Network Error" }),
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

// --- Server-supplied explanations on statuses that may carry one -------------

test("403 prefers the server's explanation over the generic permission copy", () => {
  const err = httpErr(403, {
    message: "A restructure must be approved by someone other than the person who created it.",
  });
  assert.equal(
    getErrorMessage(err),
    "A restructure must be approved by someone other than the person who created it."
  );
});

test("403 with no server message still falls back to the generic copy", () => {
  assert.equal(getErrorMessage(httpErr(403, {})), "You don't have permission to do that.");
});

test("404 prefers a written explanation when the server gives one", () => {
  const err = httpErr(404, { message: "That loan product is no longer available." });
  assert.equal(getErrorMessage(err), "That loan product is no longer available.");
});

test("404 does NOT leak Laravel's route-model-binding message", () => {
  const err = httpErr(404, { message: "No query results for model [App\\Models\\Loan] 99999" });
  assert.equal(getErrorMessage(err), "We couldn't find what you were looking for.");
});

test("409 prefers the server's explanation", () => {
  const err = httpErr(409, { message: "This loan already has a restructure in progress." });
  assert.equal(getErrorMessage(err), "This loan already has a restructure in progress.");
});

test("401 ignores the server message — session copy is always right", () => {
  const err = httpErr(401, { message: "Token signature could not be verified." });
  assert.equal(getErrorMessage(err), "Your session has expired. Please sign in again.");
});

test("500 never surfaces the server body", () => {
  const err = httpErr(500, { message: "Connection refused on 127.0.0.1:3306" });
  assert.equal(getErrorMessage(err), "Something went wrong on our end. Please try again in a moment.");
});

test("a technical 403 body is rejected in favour of the generic copy", () => {
  const err = httpErr(403, { message: "AuthorizationException thrown in Gate::class" });
  assert.equal(getErrorMessage(err), "You don't have permission to do that.");
});

test("404 rejects a model-binding message even without a class path", () => {
  // Laravel omits the namespace when the model is bound by its short name, so
  // the backslash guard alone would let this through.
  const err = httpErr(404, { message: "No query results for model Loan 42" });
  assert.equal(getErrorMessage(err), "We couldn't find what you were looking for.");
});

test("Laravel's other stock bodies never beat our own copy", () => {
  assert.equal(
    getErrorMessage(httpErr(403, { message: "This action is unauthorized." })),
    "You don't have permission to do that."
  );
  assert.equal(
    getErrorMessage(httpErr(404, { message: "Not Found" })),
    "We couldn't find what you were looking for."
  );
});
