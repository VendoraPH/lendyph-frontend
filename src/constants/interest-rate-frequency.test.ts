import { test } from "node:test";
import assert from "node:assert/strict";
import { INTEREST_RATE_FREQUENCY_OPTIONS, PAYMENT_FREQUENCY_OPTIONS } from "./index";

test("a rate can be quoted per year, labelled Annual", () => {
  assert.deepEqual(
    INTEREST_RATE_FREQUENCY_OPTIONS.map((o) => [o.value, o.label]),
    [
      ["daily", "Daily"],
      ["weekly", "Weekly"],
      ["bi_weekly", "Bi-Weekly"],
      ["semi_monthly", "Semi-Monthly"],
      ["monthly", "Monthly"],
      ["annual", "Annual"],
    ],
  );
});

test("annual is never offered as a payment frequency", () => {
  assert.equal(
    PAYMENT_FREQUENCY_OPTIONS.some((o) => String(o.value) === "annual"),
    false,
  );
});
