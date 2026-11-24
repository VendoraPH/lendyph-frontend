import { test } from "node:test";
import assert from "node:assert/strict";
import { registrationCode } from "./registration-code";

// The Registrations list's own code: a registration isn't a member yet, so it
// reads by its status and record id, never by a BRW- member code.
test("a pending registration reads PEND and a rejected one REJ, with its id in four digits", () => {
  assert.equal(registrationCode("pending", 13), "PEND-0013");
  assert.equal(registrationCode("rejected", 13), "REJ-0013");
});

test("an id longer than four digits is kept whole", () => {
  assert.equal(registrationCode("pending", 12345), "PEND-12345");
});
