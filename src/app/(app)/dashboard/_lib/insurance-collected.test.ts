import { test } from "node:test";
import assert from "node:assert/strict";
import { insuranceCollected } from "./insurance-collected";

// Decision 6(a): `total_collected` leaves the insurance premium out and the
// server sends the premium as its own `insurance_collected`. The browser shows
// it as sent and never derives it from other figures.
test("reads the server's insurance_collected", () => {
  assert.equal(insuranceCollected({ total_collected: 50_000, insurance_collected: 1_200 }), 1_200);
});

test("a decimal string reads as a number and zero is a real zero", () => {
  assert.equal(insuranceCollected({ insurance_collected: "400.50" }), 400.5);
  assert.equal(insuranceCollected({ insurance_collected: 0 }), 0);
});

test("not sent (older server, loading or failed) is null, never 0", () => {
  assert.equal(insuranceCollected({ total_collected: 50_000 }), null);
  assert.equal(insuranceCollected({ insurance_collected: null }), null);
  assert.equal(insuranceCollected(null), null);
});
