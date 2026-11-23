import { test } from "node:test";
import assert from "node:assert/strict";
import { amlaFound, amlaRefused, amlaStepConflict } from "./record-read";

const failed = (status: number, message?: string) => ({ isAxiosError: true, response: { status, data: message ? { message } : {} } });

test("a record that was read is found", () => {
  assert.deepEqual(amlaFound({ id: 4 }), { record: { id: 4 } });
});

test("a 404 reads as not found or out of reach, in words, never as not connected", () => {
  assert.deepEqual(amlaRefused(failed(404)), {
    refused: "not_found",
    message: "This record doesn't exist, or it is outside what you can see.",
  });
});

test("a 403 reads as no access, in the server's words when it gives them", () => {
  assert.deepEqual(amlaRefused(failed(403, "Reading STRs needs head-office access.")), {
    refused: "no_access",
    message: "Reading STRs needs head-office access.",
  });
  assert.equal((amlaRefused(failed(403)) as { message: string }).message, "You don't have access to this record.");
});

test("any other failure is left to the page's error state, so Retry still works", () => {
  const err = failed(500);
  assert.throws(() => amlaRefused(err), (thrown) => thrown === err);
  const offline = new Error("Network Error");
  assert.throws(() => amlaRefused(offline), (thrown) => thrown === offline);
});

test("a step refused with 409 gives the server's words; anything else is not a conflict", () => {
  assert.equal(amlaStepConflict(failed(409, "This alert is closed with a documented reason, so it can't change.")), "This alert is closed with a documented reason, so it can't change.");
  assert.equal(amlaStepConflict(failed(409)), "Someone else changed this record first. It has been read again.");
  assert.equal(amlaStepConflict(failed(422, "Say why.")), null);
  assert.equal(amlaStepConflict(new Error("x")), null);
});
