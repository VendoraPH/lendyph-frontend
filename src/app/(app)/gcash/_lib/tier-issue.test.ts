import { test } from "node:test";
import assert from "node:assert/strict";
import { gcashTierIssue } from "./tier-issue";

const base = {
  loading: false,
  error: null,
  tierCount: 3,
  amount: 500,
  charge: 15,
};

test("no issue while the tiers are still loading", () => {
  assert.equal(
    gcashTierIssue({ ...base, loading: true, error: "boom", tierCount: 0 }),
    null,
  );
});

test("a failed load is reported before anything else", () => {
  assert.equal(
    gcashTierIssue({ ...base, error: "Network Error", tierCount: 0, charge: null }),
    "load_error",
  );
});

test("no tiers at all, whatever the amount", () => {
  assert.equal(gcashTierIssue({ ...base, tierCount: 0, charge: null }), "no_tiers");
  assert.equal(
    gcashTierIssue({ ...base, tierCount: 0, amount: 0, charge: null }),
    "no_tiers",
  );
});

test("an amount that no tier covers", () => {
  assert.equal(
    gcashTierIssue({ ...base, amount: 999999, charge: null }),
    "out_of_range",
  );
});

test("no issue before an amount is typed, or once a charge resolves", () => {
  assert.equal(gcashTierIssue({ ...base, amount: 0, charge: null }), null);
  assert.equal(gcashTierIssue({ ...base, amount: Number.NaN, charge: null }), null);
  assert.equal(gcashTierIssue(base), null);
});

test("a zero charge is a resolved charge, not a missing tier", () => {
  assert.equal(gcashTierIssue({ ...base, charge: 0 }), null);
});
