import { test } from "node:test";
import assert from "node:assert/strict";
import { readablePaymentRemarks, withoutLegacyPaymentMeta } from "./legacy-remarks";

/**
 * New Payment used to fold the cashier's method, reference and collector into
 * the remarks as `[method=... | ref=... | collected_by=...]`, on a line of its
 * own after anything staff typed. Old rows keep that text. History hides it and
 * the receipts read it as a sentence. A new payment sends `method` and
 * `reference_number` instead.
 */

test("a remark that is only the legacy line reads as no remark", () => {
  assert.equal(withoutLegacyPaymentMeta("[method=GCash | ref=ABC123 | collected_by=Ana Cruz]"), "");
  assert.equal(withoutLegacyPaymentMeta("[method=Cash]"), "");
});

test("what staff typed stays when the legacy line follows it", () => {
  assert.equal(
    withoutLegacyPaymentMeta("Paid at the branch\n[method=Cash | collected_by=Ana Cruz]"),
    "Paid at the branch",
  );
});

test("what staff typed stays when the legacy text comes first", () => {
  assert.equal(
    withoutLegacyPaymentMeta("[method=GCash | collected_by=Ana Cruz] Paid at the branch"),
    "Paid at the branch",
  );
});

test("several lines of real remarks keep their line breaks", () => {
  assert.equal(
    withoutLegacyPaymentMeta("First line\nSecond line\n[method=Cash]"),
    "First line\nSecond line",
  );
});

test("remarks without the legacy line are untouched", () => {
  assert.equal(withoutLegacyPaymentMeta("Collected by Ana Cruz"), "Collected by Ana Cruz");
  assert.equal(withoutLegacyPaymentMeta("[urgent] method=cash is fine"), "[urgent] method=cash is fine");
  assert.equal(withoutLegacyPaymentMeta("See note [method=Cash]"), "See note [method=Cash]");
});

test("no remarks stay empty", () => {
  assert.equal(withoutLegacyPaymentMeta(null), "");
  assert.equal(withoutLegacyPaymentMeta(undefined), "");
  assert.equal(withoutLegacyPaymentMeta(""), "");
});

// The legacy line can be the only record of an old payment's reference and
// collector, so the receipts turn it into a sentence instead of dropping it.
test("the receipts read the legacy line as a clean remark", () => {
  assert.equal(
    readablePaymentRemarks("[method=GCash | ref=GC12345678 | collected_by=Maria Santos]"),
    "Recorded as GCash, reference GC12345678, collected by Maria Santos",
  );
});

test("only the parts present are named", () => {
  assert.equal(readablePaymentRemarks("[method=Cash]"), "Recorded as Cash");
  assert.equal(
    readablePaymentRemarks("[method=Cash | collected_by=Maria Santos]"),
    "Recorded as Cash, collected by Maria Santos",
  );
  assert.equal(readablePaymentRemarks("[method=GCash | ref=GC1]"), "Recorded as GCash, reference GC1");
  assert.equal(readablePaymentRemarks("[method= | ref=GC1]"), "Reference GC1");
  assert.equal(readablePaymentRemarks("[method=]"), "");
});

test("what staff typed comes first and is kept as typed", () => {
  assert.equal(
    readablePaymentRemarks("Paid at the branch\n[method=Cash | collected_by=Maria Santos]"),
    "Paid at the branch. Recorded as Cash, collected by Maria Santos",
  );
  assert.equal(
    readablePaymentRemarks("Paid early!\n[method=Cash]"),
    "Paid early! Recorded as Cash",
  );
  assert.equal(
    readablePaymentRemarks("[method=GCash | ref=GC1] Paid at the branch"),
    "Paid at the branch. Recorded as GCash, reference GC1",
  );
});

test("remarks without the legacy line read as they are", () => {
  assert.equal(readablePaymentRemarks("Collected by Ana Cruz"), "Collected by Ana Cruz");
  assert.equal(readablePaymentRemarks("See note [method=Cash]"), "See note [method=Cash]");
  assert.equal(readablePaymentRemarks(null), "");
  assert.equal(readablePaymentRemarks(""), "");
});
