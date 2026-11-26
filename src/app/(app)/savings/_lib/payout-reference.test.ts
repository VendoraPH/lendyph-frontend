import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MISSING_REFERENCE_HREF,
  MISSING_REFERENCE_METHOD_OPTIONS,
  missingReferenceEmptyText,
  recordReferenceLabel,
  RECORD_REFERENCE_MAX,
  missingReferenceCountText,
  missingReferenceParams,
  recordReferenceProblem,
  registerViewOf,
  typedReference,
} from "./payout-reference";

test("the reference is required, in the server's words", () => {
  assert.equal(recordReferenceProblem("", "transaction"), "Enter the reference of this payout.");
  assert.equal(recordReferenceProblem("   ", "time_deposit"), "Enter the reference of this payout.");
  assert.equal(recordReferenceProblem(" GC-1 ", "transaction"), null);
});

test("the length limit is the posting request's: 64 on a transaction, 100 on a time deposit, after trimming", () => {
  assert.deepEqual(RECORD_REFERENCE_MAX, {
    transaction: 64,
    time_deposit: 100,
  });
  assert.equal(recordReferenceProblem("A".repeat(64), "transaction"), null);
  assert.equal(recordReferenceProblem(` ${"A".repeat(64)} `, "transaction"), null);
  assert.equal(recordReferenceProblem("A".repeat(65), "transaction"), "The reference can be at most 64 characters.");
  assert.equal(recordReferenceProblem("A".repeat(100), "time_deposit"), null);
  assert.equal(recordReferenceProblem("A".repeat(101), "time_deposit"), "The reference can be at most 100 characters.");
});

test("the typed reference reads as typed, else a dash", () => {
  assert.equal(typedReference("GC-1"), "GC-1");
  assert.equal(typedReference("  GC-1  "), "GC-1");
  for (const blank of [null, undefined, "", "   "]) assert.equal(typedReference(blank), "—");
});

test("the missing list's params leave out what isn't chosen", () => {
  assert.deepEqual(
    missingReferenceParams({
      page: 2,
      branchId: undefined,
      dateFrom: "",
      dateTo: "",
      method: "all",
    }),
    { page: 2 },
  );
  assert.deepEqual(
    missingReferenceParams({
      page: 1,
      branchId: 3,
      dateFrom: "2026-11-01",
      dateTo: "2026-11-30",
      method: "gcash",
    }),
    {
      page: 1,
      branch_id: 3,
      date_from: "2026-11-01",
      date_to: "2026-11-30",
      method: "gcash",
    },
  );
});

test("the method filter offers the three non-cash methods in words", () => {
  assert.deepEqual(
    MISSING_REFERENCE_METHOD_OPTIONS.map((o) => [o.value, o.label]),
    [
      ["all", "All methods"],
      ["bank_transfer", "Bank transfer"],
      ["gcash", "GCash"],
      ["maya", "Maya"],
    ],
  );
});

test("the register opens on the missing list only from its own link", () => {
  assert.equal(MISSING_REFERENCE_HREF, "/savings/transactions?view=missing-reference");
  assert.equal(registerViewOf("missing-reference"), "missing-reference");
  for (const other of [null, "", "all", "other"]) assert.equal(registerViewOf(other), "all");
});

test("the dashboard's count reads in words from the server's figure, never counted here", () => {
  assert.equal(missingReferenceCountText(0), "Every non-cash payout has its reference.");
  assert.equal(missingReferenceCountText(1), "1 payout by bank transfer, GCash or Maya has no reference yet.");
  assert.equal(missingReferenceCountText(12), "12 payouts by bank transfer, GCash or Maya have no reference yet.");
  assert.equal(missingReferenceCountText(undefined), null);
});

test("the empty list says what it means: none missing at all, or none matching the filters", () => {
  const none = { method: "all", branchFiltered: false, dateFrom: "", dateTo: "" };
  assert.equal(missingReferenceEmptyText(none), "Every payout by bank transfer, GCash or Maya has its reference.");
  assert.equal(
    missingReferenceEmptyText({ ...none, method: "gcash" }),
    "No GCash payouts are missing a reference for these filters.",
  );
  assert.equal(
    missingReferenceEmptyText({ ...none, method: "bank_transfer" }),
    "No bank transfer payouts are missing a reference for these filters.",
  );
  assert.equal(
    missingReferenceEmptyText({ ...none, branchFiltered: true }),
    "No payouts are missing a reference for these filters.",
  );
  assert.equal(
    missingReferenceEmptyText({ ...none, dateFrom: "2026-11-01" }),
    "No payouts are missing a reference for these filters.",
  );
});

test("each Record reference button is named by its own number", () => {
  assert.equal(recordReferenceLabel("SVT-20261126-000005"), "Record reference for SVT-20261126-000005");
  assert.equal(recordReferenceLabel("TD-2026-000012"), "Record reference for TD-2026-000012");
});
