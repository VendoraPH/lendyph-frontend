import { test } from "node:test";
import assert from "node:assert/strict";
import { TRANSFER_REFERENCE_MAX, buildTransferPayload } from "./transfer-payload";

const FORM = {
  date: "2026-11-09",
  fromId: 1,
  toId: 2,
  amount: "5,000.00",
  charge: "",
  reference: "",
  description: " GCash to bank sweep ",
};

test("a transfer with a reference sends it, trimmed", () => {
  assert.deepEqual(buildTransferPayload({ ...FORM, reference: "  DEP-2026-11-09 " }), {
    date: "2026-11-09",
    from_account_id: 1,
    to_account_id: 2,
    amount: 500_000,
    description: "GCash to bank sweep",
    reference: "DEP-2026-11-09",
  });
});

test("a transfer without a reference sends the same body as before", () => {
  const payload = buildTransferPayload(FORM);
  assert.deepEqual(payload, {
    date: "2026-11-09",
    from_account_id: 1,
    to_account_id: 2,
    amount: 500_000,
    description: "GCash to bank sweep",
  });
  assert.equal(payload !== null && "reference" in payload, false);
});

test("a charge is sent in whole centavos", () => {
  assert.equal(buildTransferPayload({ ...FORM, charge: "15" })?.charge, 1_500);
});

test("the reference is at most 64 characters", () => {
  assert.equal(TRANSFER_REFERENCE_MAX, 64);
  assert.equal(
    buildTransferPayload({ ...FORM, reference: "R".repeat(64) })?.reference,
    "R".repeat(64),
  );
  assert.equal(buildTransferPayload({ ...FORM, reference: "R".repeat(65) }), null);
});

test("an incomplete transfer is refused before sending", () => {
  assert.equal(buildTransferPayload({ ...FORM, fromId: null }), null);
  assert.equal(buildTransferPayload({ ...FORM, toId: null }), null);
  assert.equal(buildTransferPayload({ ...FORM, toId: 1 }), null, "same account both sides");
  assert.equal(buildTransferPayload({ ...FORM, amount: "0" }), null);
  assert.equal(buildTransferPayload({ ...FORM, amount: "abc" }), null);
  assert.equal(buildTransferPayload({ ...FORM, description: "  " }), null);
});

test("with branches:view_all, the picked branch is sent, and No branch as null", () => {
  assert.equal(buildTransferPayload({ ...FORM, branchId: 3 })?.branch_id, 3);
  const headOffice = buildTransferPayload({ ...FORM, branchId: null });
  assert.equal(headOffice !== null && "branch_id" in headOffice, true);
  assert.equal(headOffice?.branch_id, null);
});

test("a branch user sends no branch, so the server records their own", () => {
  const payload = buildTransferPayload({ ...FORM, branchId: undefined });
  assert.equal(payload !== null && "branch_id" in payload, false);
});
