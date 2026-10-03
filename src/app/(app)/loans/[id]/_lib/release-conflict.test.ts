import { test } from "node:test";
import assert from "node:assert/strict";
import { releaseConflictOf } from "./release-conflict";

function httpError(status: number, data: unknown) {
  return { isAxiosError: true, response: { status, data } };
}

test("a 409 naming the fee fingerprint is a fee change", () => {
  const err = httpError(409, {
    message: "The fee configuration changed after this release was previewed.",
    errors: { fee_fingerprint: ["The fee configuration changed after this release was previewed."] },
  });
  assert.equal(releaseConflictOf(err), "fees_changed");
});

test("any other 409 is another change to the loan", () => {
  const err = httpError(409, {
    message: "Another change to this loan was saved at the same time. Reload and try again.",
  });
  assert.equal(releaseConflictOf(err), "loan_changed");
});

test("a 409 whose errors are not a field map is another change to the loan", () => {
  assert.equal(releaseConflictOf(httpError(409, { message: "Conflict", errors: "fee_fingerprint" })), "loan_changed");
});

test("anything that is not a 409 is no conflict", () => {
  assert.equal(releaseConflictOf(httpError(422, { errors: { status: ["Loan must be approved."] } })), null);
  assert.equal(releaseConflictOf(new Error("network")), null);
  assert.equal(releaseConflictOf(null), null);
});
