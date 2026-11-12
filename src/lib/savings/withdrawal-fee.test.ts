import { test } from "node:test";
import assert from "node:assert/strict";
import {
  feeOf,
  postedWithdrawalText,
  withdrawalFeeRuleHint,
  withFeeText,
} from "./withdrawal-fee";

test("a fee shows only when the server sent one above ₱0.00", () => {
  assert.equal(feeOf({ fee_amount: "25.00" }), "25.00");
  assert.equal(feeOf({ fee_amount: "0.00" }), null);
  assert.equal(feeOf({ fee_amount: null }), null);
  assert.equal(feeOf({}), null);
});

test("an amount with its fee lists both server figures and adds nothing up", () => {
  assert.equal(withFeeText("500.00", "25.00"), "₱500.00 plus a ₱25.00 excess-withdrawal fee");
  assert.equal(withFeeText("500.00", null), "₱500.00");
});

test("the withdrawal toast names the amount and the fee", () => {
  assert.equal(
    postedWithdrawalText({ debit: "500.00", fee_amount: "25.00", balance_after: "4000.00" }),
    "₱500.00 withdrawn, plus a ₱25.00 excess-withdrawal fee.",
  );
  assert.equal(postedWithdrawalText({ debit: "500.00", fee_amount: null, balance_after: "4000.00" }), "₱500.00 withdrawn.");
});

test("before posting, the dialog states the product's fee rule from the server's product", () => {
  assert.equal(
    withdrawalFeeRuleHint({ free_withdrawals_per_month: 4, excess_withdrawal_fee: "25.00" }),
    "4 free withdrawals a month. Each one after that takes a ₱25.00 excess-withdrawal fee; the server applies it when you post.",
  );
  assert.equal(
    withdrawalFeeRuleHint({ free_withdrawals_per_month: 1, excess_withdrawal_fee: null }),
    "1 free withdrawal a month. More are refused this month.",
  );
  assert.equal(withdrawalFeeRuleHint({ free_withdrawals_per_month: null, excess_withdrawal_fee: "25.00" }), null);
  assert.equal(withdrawalFeeRuleHint(null), null);
});
