import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_SAVINGS_PRODUCT_FORM, formToPayload, productToForm } from "./product-form";
import type { SavingsProduct } from "@/types/savings";

const filled = {
  ...EMPTY_SAVINGS_PRODUCT_FORM,
  code: " rs-01 ",
  name: "Regular Savings",
  min_initial_deposit: "1000",
  min_maintaining_balance: "500.50",
  min_balance_to_earn_interest: "1000",
  interest_rate: "1.125",
};

describe("savings product form", () => {
  test("builds the payload exactly, code upper-cased, blank cap = null", () => {
    const r = formToPayload(filled);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.payload.code, "RS-01");
    assert.equal(r.payload.min_maintaining_balance, 500.5);
    assert.equal(r.payload.interest_rate, 1.125);
    assert.equal(r.payload.max_withdrawal_amount, null);
    assert.equal(r.payload.description, null);
  });

  test("names every missing field at once", () => {
    const r = formToPayload(EMPTY_SAVINGS_PRODUCT_FORM);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.deepEqual(r.fields, ["Product code", "Product name", "Interest rate"]);
  });

  test("refuses sub-centavo amounts and out-of-range rates with a reason", () => {
    const r = formToPayload({ ...filled, min_initial_deposit: "10.555" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message ?? "", /two decimals/);
    const rate = formToPayload({ ...filled, interest_rate: "101" });
    assert.equal(rate.ok, false);
    if (!rate.ok) assert.match(rate.message ?? "", /0 to 100/);
  });

  test("without savings:settings the interest terms are neither required nor sent", () => {
    const r = formToPayload({ ...filled, interest_rate: "" }, false);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal("interest_rate" in r.payload, false);
    assert.equal("interest_method" in r.payload, false);
    assert.equal("posting_frequency" in r.payload, false);
  });

  test("a zero withdrawal cap is refused (blank means no cap)", () => {
    const r = formToPayload({ ...filled, max_withdrawal_amount: "0" });
    assert.equal(r.ok, false);
  });

  test("a saved product round-trips without rounding", () => {
    const product = {
      id: 1,
      code: "RS",
      name: "Regular",
      description: null,
      product_type: "Regular",
      min_initial_deposit: "1000.00",
      min_maintaining_balance: "500.50",
      min_balance_to_earn_interest: "0.00",
      interest_rate: "1.125000",
      interest_method: "daily_balance",
      posting_frequency: "quarterly",
      allow_deposits: true,
      allow_withdrawals: false,
      allow_multiple_accounts: true,
      max_withdrawal_amount: "20000.00",
      status: "inactive",
      created_at: "",
      updated_at: "",
    } satisfies SavingsProduct;
    const form = productToForm(product);
    assert.equal(form.interest_rate, "1.125");
    assert.equal(form.min_maintaining_balance, "500.5");
    assert.equal(form.max_withdrawal_amount, "20000");
    const back = formToPayload(form);
    assert.equal(back.ok, true);
    if (back.ok) {
      assert.equal(back.payload.min_maintaining_balance, 500.5);
      assert.equal(back.payload.max_withdrawal_amount, 20000);
      assert.equal(back.payload.status, "inactive");
    }
  });
});
