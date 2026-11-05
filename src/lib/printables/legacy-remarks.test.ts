import { test } from "node:test";
import assert from "node:assert/strict";
import { withoutLegacyPaymentMeta } from "./legacy-remarks";

/**
 * New Payment used to fold the cashier's method, reference and collector into
 * the remarks as `[method=... | ref=... | collected_by=...]`, on a line of its
 * own after anything staff typed. Old rows keep that text; the receipt and
 * history hide it. A new payment sends `method` and `reference_number` instead.
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
