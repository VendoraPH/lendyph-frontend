import { test } from "node:test";
import assert from "node:assert/strict";
import {
  feeOf,
  nextWithdrawalFeeText,
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

// Gap round B9: the server's total with the fee, where the amount and fee are listed.
test("the server's total with the fee is shown beside the amount and the fee", () => {
  assert.equal(withFeeText("500.00", "25.00", "525.00"), "₱500.00 plus a ₱25.00 excess-withdrawal fee, ₱525.00 in all");
  assert.equal(withFeeText("500.00", null, null), "₱500.00");
  assert.equal(
    postedWithdrawalText({ debit: "500.00", fee_amount: "25.00", balance_after: "4000.00", total_with_fee: "525.00" }),
    "₱500.00 withdrawn, plus a ₱25.00 excess-withdrawal fee (₱525.00 in all).",
  );
});

test("the withdrawal dialog states the account's next fee from the server, and a refusal in words", () => {
  const rule = { free_withdrawals_per_month: 2, excess_withdrawal_fee: "25.00", allow_withdrawals: true };
  assert.equal(
    nextWithdrawalFeeText({ next_withdrawal_fee: "0.00", free_withdrawals_left: 2 }, rule),
    "This withdrawal is free: 2 free withdrawals are left this month.",
  );
  assert.equal(
    nextWithdrawalFeeText({ next_withdrawal_fee: "0.00", free_withdrawals_left: 1 }, rule),
    "This withdrawal is free: 1 free withdrawal is left this month.",
  );
  assert.equal(
    nextWithdrawalFeeText({ next_withdrawal_fee: "0.00", free_withdrawals_left: null }, null),
    "Withdrawals on this product are free.",
  );
  assert.equal(
    nextWithdrawalFeeText({ next_withdrawal_fee: "25.00", free_withdrawals_left: 0 }, rule),
    "No free withdrawal is left this month, so this withdrawal takes a ₱25.00 excess-withdrawal fee.",
  );
  assert.equal(
    nextWithdrawalFeeText({ next_withdrawal_fee: null, free_withdrawals_left: 0 }, { ...rule, excess_withdrawal_fee: null }),
    "A withdrawal would be refused today: no free withdrawal is left this month, and the product allows no more.",
  );
  assert.equal(
    nextWithdrawalFeeText({ next_withdrawal_fee: null, free_withdrawals_left: null }, { ...rule, allow_withdrawals: false }),
    "A withdrawal would be refused: this product allows no withdrawals.",
  );
  assert.equal(
    nextWithdrawalFeeText({ next_withdrawal_fee: null, free_withdrawals_left: 2 }, rule),
    "A withdrawal would be refused on this account today.",
  );
  // An older server that sends neither field: the product's rule, as before.
  assert.equal(
    nextWithdrawalFeeText({}, rule),
    "2 free withdrawals a month. Each one after that takes a ₱25.00 excess-withdrawal fee; the server applies it when you post.",
  );
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
