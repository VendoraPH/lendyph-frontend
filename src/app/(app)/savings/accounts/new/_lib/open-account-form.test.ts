import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { emptyOpenAccountForm, openAccountPayload } from "./open-account-form";

const TODAY = "2026-11-03";
const product = { status: "active" as const, min_initial_deposit: "500.00" };
const filled = {
  ...emptyOpenAccountForm(TODAY),
  borrower_id: 7,
  savings_product_id: 2,
  initial_deposit: "500",
  reference_number: "  OR-1 ",
  remarks: " ",
};

describe("open-account form", () => {
  test("builds the payload exactly, blanks left out", () => {
    const r = openAccountPayload(filled, product, TODAY);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.payload, {
      borrower_id: 7,
      savings_product_id: 2,
      opened_at: TODAY,
      initial_deposit: 500,
      payment_method: "cash",
      reference_number: "OR-1",
    });
  });

  test("names every missing field at once", () => {
    const r = openAccountPayload(emptyOpenAccountForm(TODAY), null, TODAY);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.deepEqual(r.fields, ["Member", "Savings product", "Initial deposit"]);
  });

  test("below the product's minimum initial deposit is refused with the minimum", () => {
    const r = openAccountPayload({ ...filled, initial_deposit: "499.99" }, product, TODAY);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message ?? "", /at least/);
  });

  test("an inactive product and a future date are refused", () => {
    const inactive = openAccountPayload(filled, { ...product, status: "inactive" }, TODAY);
    assert.equal(inactive.ok, false);
    if (!inactive.ok) assert.match(inactive.message ?? "", /inactive/);
    const future = openAccountPayload({ ...filled, opened_at: "2026-11-04" }, product, TODAY);
    assert.equal(future.ok, false);
    if (!future.ok) assert.match(future.message ?? "", /future/);
  });
});
