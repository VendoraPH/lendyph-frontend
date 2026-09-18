import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPasswordChangeRequiredError,
  safeReturnPath,
  changePasswordUrl,
  PASSWORD_CHANGE_REQUIRED_CODE,
  CHANGE_PASSWORD_PATH,
} from "./password-change-required";

const httpErr = (status: number, data?: unknown) => ({ response: { status, data } });

// ── isPasswordChangeRequiredError ──

test("the documented 423 body is recognised", () => {
  const err = httpErr(423, {
    message:
      "Your password was reset by an administrator. You must set a new password before continuing.",
    code: PASSWORD_CHANGE_REQUIRED_CODE,
    must_change_password: true,
  });
  assert.equal(isPasswordChangeRequiredError(err), true);
});

// The message is copy and may be reworded at any time; only the code is the
// contract. If this ever starts failing because someone matched on prose, the
// feature has regressed.
test("a reworded message with the right code still locks", () => {
  const err = httpErr(423, {
    message: "Please pick a new password to carry on.",
    code: PASSWORD_CHANGE_REQUIRED_CODE,
  });
  assert.equal(isPasswordChangeRequiredError(err), true);
});

test("the documented message WITHOUT the code is not enough on another status", () => {
  const err = httpErr(403, {
    message:
      "Your password was reset by an administrator. You must set a new password before continuing.",
    code: PASSWORD_CHANGE_REQUIRED_CODE,
  });
  assert.equal(isPasswordChangeRequiredError(err), false);
});

test("a bare 423 with no body is treated as locked", () => {
  assert.equal(isPasswordChangeRequiredError(httpErr(423)), true);
  assert.equal(isPasswordChangeRequiredError(httpErr(423, {})), true);
});

test("a 423 claiming a DIFFERENT code is left alone", () => {
  const err = httpErr(423, { code: "resource_checked_out" });
  assert.equal(isPasswordChangeRequiredError(err), false);
});

test("other statuses never lock", () => {
  for (const status of [400, 401, 403, 409, 422, 429, 500]) {
    assert.equal(isPasswordChangeRequiredError(httpErr(status)), false);
  }
});

test("non-HTTP throws never lock", () => {
  assert.equal(isPasswordChangeRequiredError(null), false);
  assert.equal(isPasswordChangeRequiredError(undefined), false);
  assert.equal(isPasswordChangeRequiredError("423"), false);
  assert.equal(isPasswordChangeRequiredError(new Error("Network Error")), false);
  assert.equal(isPasswordChangeRequiredError({}), false);
});

// ── safeReturnPath ──

test("an ordinary in-app path is kept", () => {
  assert.equal(safeReturnPath("/loans/42"), "/loans/42");
  assert.equal(safeReturnPath("/reports/aging?branch=3"), "/reports/aging?branch=3");
});

test("a javascript: URL is refused", () => {
  assert.equal(safeReturnPath("javascript:alert(1)"), "/dashboard");
});

test("an absolute URL to another origin is refused", () => {
  assert.equal(safeReturnPath("https://evil.tld/steal"), "/dashboard");
});

// Protocol-relative URLs start with `/` and so pass a naive startsWith check,
// then send the browser clean off-origin.
test("a protocol-relative URL is refused", () => {
  assert.equal(safeReturnPath("//evil.tld/steal"), "/dashboard");
  assert.equal(safeReturnPath("/\\evil.tld"), "/dashboard");
});

test("the change-password screen itself is never a return path", () => {
  assert.equal(safeReturnPath(CHANGE_PASSWORD_PATH), "/dashboard");
  assert.equal(safeReturnPath(`${CHANGE_PASSWORD_PATH}?next=/loans`), "/dashboard");
});

test("empty and non-string inputs fall back", () => {
  assert.equal(safeReturnPath(null), "/dashboard");
  assert.equal(safeReturnPath(undefined), "/dashboard");
  assert.equal(safeReturnPath(""), "/dashboard");
  assert.equal(safeReturnPath("   "), "/dashboard");
});

// ── changePasswordUrl ──

test("the locked URL remembers a safe destination", () => {
  assert.equal(
    changePasswordUrl("/loans/42"),
    `${CHANGE_PASSWORD_PATH}?next=%2Floans%2F42`
  );
});

test("the locked URL drops an unsafe destination rather than defaulting it", () => {
  assert.equal(changePasswordUrl("https://evil.tld"), CHANGE_PASSWORD_PATH);
  assert.equal(changePasswordUrl(null), CHANGE_PASSWORD_PATH);
});

test("a query string in the destination survives the round trip", () => {
  const url = changePasswordUrl("/reports/aging?branch=3");
  const next = new URLSearchParams(url.split("?")[1]).get("next");
  assert.equal(next, "/reports/aging?branch=3");
});
