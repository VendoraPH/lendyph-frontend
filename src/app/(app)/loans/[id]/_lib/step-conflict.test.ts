import { test } from "node:test";
import assert from "node:assert/strict";
import { stepConflictMessage } from "./step-conflict";

function httpError(status: number, data: unknown) {
  return { isAxiosError: true, response: { status, data } };
}

const STALE =
  'That approval step isn\'t waiting any more: the loan is now at the "BOD2" step. Reload it.';

test("a 409 on a step action answers the server's sentence", () => {
  assert.equal(stepConflictMessage(httpError(409, { message: STALE })), STALE);
});

test("a 409 with no readable sentence still says the loan moved on", () => {
  assert.equal(
    stepConflictMessage(httpError(409, {})),
    "That action conflicts with the current state. Refresh and try again.",
  );
});

test("anything that is not a 409 is no step conflict", () => {
  assert.equal(stepConflictMessage(httpError(403, { message: "Not your step." })), null);
  assert.equal(stepConflictMessage(httpError(422, { message: "Remarks are required." })), null);
  assert.equal(stepConflictMessage(new Error("network")), null);
  assert.equal(stepConflictMessage(null), null);
});
