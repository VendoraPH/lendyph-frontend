import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldErrorsFor } from "./field-errors";

const err422 = (errors: Record<string, string[]>) => ({ response: { status: 422, data: { message: "x", errors } } });

test("reads the server's messages for a field and its items", () => {
  const err = err422({
    categories: ["The category weights must total exactly 100.00%; they total 99.99%."],
    "categories.0.weight_percent": ["The weight must have at most 2 decimals."],
    risk_bands: ["The very high risk band must start at 0."],
  });
  assert.deepEqual(fieldErrorsFor(err, "categories"), [
    "The category weights must total exactly 100.00%; they total 99.99%.",
    "The weight must have at most 2 decimals.",
  ]);
  assert.deepEqual(fieldErrorsFor(err, "risk_bands"), ["The very high risk band must start at 0."]);
  assert.deepEqual(fieldErrorsFor(err, "factor_rules"), []);
});

test("a non-422 or a shape without errors reads nothing", () => {
  assert.deepEqual(fieldErrorsFor({ response: { status: 409, data: { message: "x" } } }, "categories"), []);
  assert.deepEqual(fieldErrorsFor(new Error("boom"), "categories"), []);
  assert.deepEqual(fieldErrorsFor(null, "categories"), []);
});
