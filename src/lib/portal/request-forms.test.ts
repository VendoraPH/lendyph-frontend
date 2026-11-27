import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_OPENING,
  EMPTY_WITHDRAWAL,
  amountText,
  openingBody,
  openingErrors,
  profileBody,
  profileErrors,
  withdrawalBody,
  withdrawalErrors,
} from "./request-forms";

test("an amount is passed on as text, never parsed or rounded", () => {
  assert.equal(amountText("10,000.00"), "10000.00");
  assert.equal(amountText("₱ 10000.01"), "10000.01");
  assert.equal(amountText("500"), "500");
  assert.equal(amountText("10.005"), null, "more than two decimals is refused, not rounded");
  assert.equal(amountText("-5"), null);
  assert.equal(amountText("abc"), null);
  assert.equal(amountText(""), null);
});

test("a withdrawal needs an account, an amount, a method and that method's details", () => {
  assert.deepEqual(Object.keys(withdrawalErrors(EMPTY_WITHDRAWAL)).sort(), ["account_id", "amount", "method"]);
  const bank = { ...EMPTY_WITHDRAWAL, account_id: "4", amount: "100", method: "bank_transfer" };
  assert.deepEqual(Object.keys(withdrawalErrors(bank)).sort(), ["account_name", "account_number", "bank_name"]);
  assert.deepEqual(Object.keys(withdrawalErrors({ ...bank, method: "gcash" })), ["gcash_number"]);
  assert.deepEqual(withdrawalErrors({ ...bank, method: "cash_pickup" }), {});
});

test("the withdrawal body carries the typed amount and only the chosen method's details", () => {
  const body = withdrawalBody(
    { ...EMPTY_WITHDRAWAL, account_id: "4", amount: "10,000.01", method: "gcash", gcash_number: " 09171234567 ", bank_name: "left over" },
    "  ",
  );
  assert.deepEqual(body, {
    type: "savings_withdrawal",
    details: { account_id: 4, amount: "10000.01", method: "gcash", gcash_number: "09171234567" },
  });
});

test("an opening needs a product, a deposit and the tick; its body names them", () => {
  assert.deepEqual(Object.keys(openingErrors(EMPTY_OPENING)).sort(), ["initial_deposit", "product_id", "terms_accepted"]);
  assert.deepEqual(openingBody({ product_id: "2", initial_deposit: "500.00", terms_accepted: true }, "Thanks"), {
    type: "savings_opening",
    details: { product_id: 2, initial_deposit: "500.00", terms_accepted: true },
    remarks: "Thanks",
  });
});

test("a profile change sends only the filled-in fields", () => {
  assert.deepEqual(profileErrors({ city: " " }), { form: "Fill in at least one change." });
  assert.deepEqual(profileBody({ city: " Cebu City ", email: "", barangay: "Lahug" }, ""), {
    type: "profile_update",
    details: { city: "Cebu City", barangay: "Lahug" },
  });
});
