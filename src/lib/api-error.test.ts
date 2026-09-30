import { test } from "node:test";
import assert from "node:assert/strict";
import { AxiosError, CanceledError } from "axios";
import { getErrorMessage, getFieldErrors, firstFieldError, httpStatusOf } from "./api-error";
import { IncompleteListError } from "./paginate";

const httpErr = (status: number, data?: unknown) => ({ response: { status, data } });

/**
 * What axios actually rejects with when a request left and nothing came back:
 * the request it sent, no response. Built with the real class so the shape
 * cannot drift from the library.
 */
const noReply = (code: string, message: string) =>
  new AxiosError(message, code, undefined, { sent: true });

const OFFLINE = "You appear to be offline. Check your connection and try again.";
const TIMEOUT =
  "That took longer than expected, and your submission may still have gone through. Please wait a moment and check before trying again.";
const GENERIC = "Something went wrong. Please try again.";

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

test("a request that got no reply maps to connection copy", () => {
  assert.equal(getErrorMessage(noReply("ERR_NETWORK", "Network Error")), OFFLINE);
});

test("no reply wins over the caller's fallback", () => {
  assert.equal(
    getErrorMessage(noReply("ERR_NETWORK", "Network Error"), "We couldn't load the roles."),
    OFFLINE
  );
});

// A timeout also arrives with no `response`, but the advice is the opposite of
// offline: the request DID leave the device and may have been processed. Telling
// someone mid-upload they are offline is what produced duplicate registrations.
test("an axios timeout warns the submission may have gone through", () => {
  assert.equal(
    getErrorMessage(noReply("ECONNABORTED", "timeout of 30000ms exceeded")),
    TIMEOUT
  );
});

test("a connect timeout (ETIMEDOUT) gets the same warning", () => {
  assert.equal(getErrorMessage(noReply("ETIMEDOUT", "connect ETIMEDOUT")), TIMEOUT);
});

// "Offline" is only true of a request that went out and heard nothing. Every
// case below also has no `response`, and none of them touched the network, so
// the caller's own words are the honest answer.
test("a thrown Error is the caller's fallback, not offline", () => {
  const err = new Error("Unexpected approval workflow response shape");
  assert.equal(getErrorMessage(err, "We couldn't load the approval workflow."), "We couldn't load the approval workflow.");
  assert.equal(getErrorMessage(err), GENERIC);
});

test("a TypeError is the caller's fallback, not offline", () => {
  let thrown: unknown;
  try {
    (undefined as unknown as { map: () => void }).map();
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown instanceof TypeError);
  assert.equal(getErrorMessage(thrown, "We couldn't load the fees."), "We couldn't load the fees.");
});

test("null and undefined are the caller's fallback, not offline", () => {
  assert.equal(getErrorMessage(null), GENERIC);
  assert.equal(getErrorMessage(undefined, "Could not open the import."), "Could not open the import.");
});

test("a look-alike object with a network code but no request is not offline", () => {
  assert.equal(getErrorMessage({ code: "ERR_NETWORK", message: "Network Error" }), GENERIC);
  assert.equal(getErrorMessage({ code: "ECONNABORTED" }, "fallback"), "fallback");
});

test("an axios error raised before anything was sent is not offline", () => {
  // No `request`: a bad option, a request interceptor that threw.
  const err = new AxiosError("options must be an object", "ERR_BAD_OPTION_VALUE");
  assert.equal(getErrorMessage(err, "We couldn't save this."), "We couldn't save this.");
});

test("a cancelled request is not offline", () => {
  const err = new CanceledError(undefined, undefined, { sent: true });
  assert.equal(err.code, "ERR_CANCELED");
  assert.equal(getErrorMessage(err, "fallback"), "fallback");
});

test("httpStatusOf reads the status, and null when nothing answered", () => {
  assert.equal(httpStatusOf(httpErr(403)), 403);
  assert.equal(httpStatusOf(noReply("ERR_NETWORK", "Network Error")), null);
  assert.equal(httpStatusOf(new Error("boom")), null);
  assert.equal(httpStatusOf(null), null);
});

// Also arrives with no `response` — because every request succeeded. "Offline"
// would send the user to retry a load that already worked; the error's own
// message says what actually happened.
test("an incomplete list is reported as incomplete, not as offline", () => {
  const err = new IncompleteListError(2000, 2400);
  const msg = getErrorMessage(err, "We couldn't load the data. Please try again.");
  assert.equal(msg, err.message);
  assert.match(msg, /Only 2000 of 2400 /);
  assert.doesNotMatch(msg, /offline/i);
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

// ── 423: password reset by an administrator ──
//
// These pin behaviour that used to be incidental. Before 423 was named here it
// reached the right answer through the "unknown status" branch, which meant any
// later edit to STATUS_COPY or STATUSES_THAT_MAY_EXPLAIN could have silently
// rerouted it. The point of the tests is that both paths are now asserted.

test("423 surfaces the server's own explanation", () => {
  const err = httpErr(423, {
    message:
      "Your password was reset by an administrator. You must set a new password before continuing.",
    code: "password_change_required",
    must_change_password: true,
  });
  assert.equal(
    getErrorMessage(err),
    "Your password was reset by an administrator. You must set a new password before continuing."
  );
});

test("423 with no body still explains itself rather than falling back", () => {
  assert.equal(
    getErrorMessage(httpErr(423), "some caller fallback"),
    "Your password was reset by an administrator. You must set a new password before continuing."
  );
});

test("423 never leaks a technical server message", () => {
  const err = httpErr(423, {
    message: "Illuminate\\Auth\\Access\\AuthorizationException: locked",
  });
  assert.equal(
    getErrorMessage(err),
    "Your password was reset by an administrator. You must set a new password before continuing."
  );
});

test("423 never leaks the internal must_change_password flag as copy", () => {
  const msg = getErrorMessage(httpErr(423, { message: "must_change_password" }));
  assert.ok(!msg.includes("must_change_password"), msg);
});

// The identifier guard must catch the shape without eating real prose that
// happens to mention a field name.
test("a human sentence containing an underscored field name still survives", () => {
  const err = httpErr(403, {
    message: "The field loan_amount must be filled in before you can submit.",
  });
  assert.equal(
    getErrorMessage(err),
    "The field loan_amount must be filled in before you can submit."
  );
});
