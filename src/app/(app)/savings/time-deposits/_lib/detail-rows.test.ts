import { test } from "node:test";
import assert from "node:assert/strict";

import { payoutReferenceRow, referenceRow } from "./detail-rows";

test("a placement's payment reference shows as its own row, exactly as the server sent it", () => {
  assert.deepEqual(referenceRow({ reference: "TD-2026-000123" }), ["Reference", "TD-2026-000123"]);
  assert.deepEqual(referenceRow({ reference: "GC-778899" }), ["Reference", "GC-778899"]);
});

test("no reference, or a blank one, adds no row", () => {
  assert.equal(referenceRow({ reference: null }), null);
  assert.equal(referenceRow({ reference: undefined }), null);
  assert.equal(referenceRow({ reference: "  " }), null);
  assert.equal(referenceRow({}), null);
});

test("a payout's reference shows as its own row; none, or a blank one, adds no row", () => {
  assert.deepEqual(payoutReferenceRow({ payout_reference: "GC-PAY-1" }), ["Payout reference", "GC-PAY-1"]);
  assert.equal(payoutReferenceRow({ payout_reference: null }), null);
  assert.equal(payoutReferenceRow({ payout_reference: " " }), null);
  assert.equal(payoutReferenceRow({}), null);
});
