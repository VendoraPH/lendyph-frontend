import { test } from "node:test";
import assert from "node:assert/strict";
import type { SavingsAccount, SavingsTransaction, TimeDeposit } from "@/types";
import {
  savingsSearchParams,
  toAccountOption,
  toTimeDepositOption,
  toWithdrawalOption,
} from "./savings-subject-search";

test("each subject searches the server 25 rows at a time; the slip lists withdrawals only", () => {
  assert.deepEqual(savingsSearchParams("savings_account", ""), { per_page: 25 });
  assert.deepEqual(savingsSearchParams("time_deposit", "TD-1"), { per_page: 25, search: "TD-1" });
  assert.deepEqual(savingsSearchParams("savings_withdrawal", "Ana"), { per_page: 25, search: "Ana", type: "withdrawal" });
});

test("rows read in words: statuses, ₱ with two decimals, a reversed withdrawal marked", () => {
  const account = toAccountOption({
    id: 9,
    account_number: "SAV-9",
    borrower_name: "Ana Reyes",
    product: { id: 1, code: "RS", name: "Regular Savings", kind: "regular" },
    status: "dormant",
  } as SavingsAccount);
  assert.deepEqual(account, { id: 9, label: "SAV-9", hint: "Ana Reyes · Regular Savings · Dormant" });

  const withdrawal = toWithdrawalOption({
    id: 31,
    reference: "SVT-31",
    borrower_name: "Ana Reyes",
    debit: "1500.5",
    date: "2026-11-10",
    reversed_by_transaction_id: 40,
  } as SavingsTransaction);
  assert.equal(withdrawal.label, "SVT-31");
  assert.match(withdrawal.hint, /₱1,500.50/);
  assert.match(withdrawal.hint, /REVERSED$/);

  const td = toTimeDepositOption({
    id: 5,
    certificate_number: "TD-5",
    borrower_name: "Ana Reyes",
    principal: "20000.00",
    status: "rolled_over",
  } as TimeDeposit);
  assert.equal(td.hint, "Ana Reyes · ₱20,000.00 · Rolled over");
});
